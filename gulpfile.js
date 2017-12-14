var gulp = require('gulp');
var $ = require('gulp-load-plugins')(); //gulp- >> $
// var jade = require('gulp-jade');
// var sass = require('gulp-sass');
// var plumber = require('gulp-plumber');
// var postcss = require('gulp-postcss');
var autoprefixer = require('autoprefixer');
// const sourcemaps = require('gulp-sourcemaps');
// const babel = require('gulp-babel');
// const concat = require('gulp-concat');
var mainBowerFiles = require('main-bower-files');
// var order = require("gulp-order");
var browserSync = require('browser-sync').create();
// let cleanCSS = require('gulp-clean-css');
// var uglify = require('gulp-uglify');
var minimist = require('minimist');
// var gulpif = require('gulp-if');
// var clean = require('gulp-clean');
// var gulpSequence = require('gulp-sequence')
// var rename = require("gulp-rename");
// const imagemin = require('gulp-imagemin');
// var ghPages = require('gulp-gh-pages');


//設定環境參數，切換開發版本
var envOptions = {
    string: 'env',
    default: {env: 'develop'}
}
var options = minimist(process.argv.slice(2), envOptions)
console.log(options);

// 刪除資料夾 (正式交付前)
gulp.task('clean', function () {
    return gulp.src(['./.tmp', './public'], { read: false })
        .pipe($.clean());
});

// 從 source 複製一份 .html 到 public
gulp.task('copyHTML', function(){
    // task 是執行任務，copyHTML 是任務名稱可隨意訂，要執行時就輸入 gulp 任務名
    return gulp.src('./source/**/*.html')
        .pipe(gulp.dest('./public/'))
        // src 接來源，dest 接目的地，pipe 可以接很多個任務
});


//複製一份 variables 到 helpers
gulp.task('copyBsV', function () {
    return gulp.src('./node_modules/bootstrap/scss/_variables.scss')
        .pipe(gulp.dest('./source/scss/helpers'))
});
//移動 font 到 public
gulp.task('copyFonts', function () {
    return gulp.src('./node_modules/font-awesome/fonts/**')
        .pipe(gulp.dest('./public/fonts'))
})


// 將 .jade 編譯成 .html 
gulp.task('jade', function () {

    gulp.src('./source/**/*.jade')
        .pipe($.plumber())
        //出錯不停止
        .pipe($.jade($.if(options.env === 'develop',{
            pretty: true
            // 加入 pretty: true 時，為非壓縮版
        })))
        .pipe(gulp.dest('./public/'))
        .pipe(browserSync.stream())
});

// 將 .scss 或 .sass 編譯成 .css
gulp.task('sass', function () {
    var plugins = [
        autoprefixer({
            browsers: ['last 3 version', '> 5%']
        })
    ];
    // browsers 的支援範圍可以改動

    return gulp.src('./source/scss/**/*.scss')
        .pipe($.plumber())
        .pipe($.sourcemaps.init())
        // 分支位置指示
        .pipe($.sass({
            outputStyle: 'nested',
            includePaths: ['./node_modules/bootstrap/scss', './node_modules/font-awesome/scss']
        }).on('error', $.sass.logError))
        //至此 css 編譯完成
        .pipe($.postcss(plugins))
        //加上前綴詞
        .pipe($.if(options.env === 'production', $.cleanCss()))
        //壓縮
        .pipe($.sourcemaps.write('.'))
        .pipe(gulp.dest('./public/css'))
        .pipe(browserSync.stream()) // 畫面同步
});

//解譯 es6 並合併成一支
gulp.task('babel', () =>
    gulp.src('./source/js/**/*.js')
        .pipe($.sourcemaps.init())
        .pipe($.babel({
            presets: ['env']
        }))
        // es6 解譯
        .pipe($.concat('all.js'))
        // 合併
        .pipe($.if(options.env === 'production', $.uglify({
            compress: {
                drop_console: true
            }
        })))
        //壓縮，去除 console.log
        .pipe($.sourcemaps.write('.'))
        .pipe(gulp.dest('./public/js'))
        .pipe(browserSync.stream())
);

//把外部 .js 資源 (主要運作部分) 從 bower_components 抓到 vendors 中
gulp.task('bower', function () {
    return gulp.src(mainBowerFiles({
        "overrides": {
            "vue": {                      
                "main": "dist/vue.js"      
            }
        }
    }))
        .pipe(gulp.dest('./.tmp/vendors'))
});

// 合併外部 .js 並匯入 public
gulp.task('vendorJs', ['bower'], function(){
    // bower 要完全做完，才做 vendors
    return gulp.src(['./.tmp/vendors/**/*.js', './node_modules/bootstrap/dist/js/bootstrap.js'])
        .pipe($.order([
            'jquery.js',
            'popper.js',
            'bootstrap.js',
            'vue.js'
        ]))    
        .pipe($.concat('vendors.js'))
        .pipe($.if(options.env === 'production', $.uglify()))
        .pipe(gulp.dest('./public/js'))
});

// 畫面同步
gulp.task('browser-sync', function () {
    browserSync.init({
        server: {
            baseDir: "./public"
        }, reloadDebounce: 2000
    });
});

//壓縮圖片，由於此步驟十分耗時，故在最後要交付時才做，在 develop 時，依然會將圖片轉移至 public
gulp.task('image-min', () =>
    gulp.src('./source/images/*')
        .pipe($.if(options.env === 'production', $.imagemin()))    
        .pipe(gulp.dest('./public/images'))
);

// 來源檔案變更時，執行指定任務 (在 watch 狀態下，按 ctrl + c 停止)
gulp.task('watch', function () {
    gulp.watch('./source/**/*.jade', ['jade']);
    gulp.watch('./source/scss/**/*.scss', ['sass']);
    gulp.watch('./source/js/**/*.js', ['babel']);
});



//上傳到 Github Pages (必須先上傳過一次)
gulp.task('deploy', function () {
    return gulp.src('./public/**/*')
        .pipe($.ghPages());
});

//把bootstrap的variables複製到helpers以利修改，把font-awesome的fonts複製一份到public (都只要做一次)
gulp.task('once', $.sequence('copyBsV', 'copyFonts'));

//交付前專案建立
gulp.task('build', $.sequence('clean', 'jade', 'sass', 'babel', 'vendorJs', 'image-min'));

// default 為預設，使用時只需輸入 gulp 即可
gulp.task('default', ['jade', 'sass', 'babel', 'vendorJs', 'browser-sync', 'watch']);