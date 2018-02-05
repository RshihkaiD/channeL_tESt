var gulp = require('gulp');
var strToUnicode = require('gulp-chinese2unicode');
var cssnano = require('gulp-cssnano');
var imagemin = require('gulp-imagemin');
var rev = require('gulp-rev');
var revCollector = require('gulp-rev-collector');
var revDel = require('gulp-rev-delete-original');
var jsonmin = require('gulp-jsonminify');
var watch = require('gulp-watch');
var merge = require('merge-stream');
var runSequence = require('run-sequence');
var vinyl = require('vinyl-paths');
var del = require('del');

gulp.task('delete', function() {
    var delFolder = gulp.src('./{css,image}')
        .pipe(vinyl(del));

    var delJson = gulp.src('./channel_list_data.json')
        .pipe(vinyl(del));

    return merge(delFolder, delJson);
});

gulp.task('moveFile', ['delete'], function() {
    return gulp.src('./src/**/*')
        .pipe(gulp.dest('./'));
});

gulp.task('cssnano', ['moveFile'], function() {
    return gulp.src("./css/**/*.css")
        .pipe(cssnano({
            browsers: ['last 2 versions'],
            zindex: false // 關閉z-index 設定
        }))
        .pipe(gulp.dest("./css"));
});

gulp.task('imagemin', ['moveFile'], function() {
    return gulp.src('./{image}/**/*.{jpg,png,svg}')
        .pipe(imagemin({
            svgoPlugins: [
                { removeXMLProcInst: true }, // 刪除XML處理指令
                { removeEmptyAttrs: true }, // 刪除空的屬性
                { removeHiddenElems: true }, // 刪除隱藏的元素
                { removeEmptyText: true }, // 刪除空的文本元素
                { removeEmptyContainers: true }, // 刪除空的容器元素
                { removeUnusedNS: true }, // 刪除未使用的名稱空間聲明
                { removeUselessStrokeAndFill: true }, // 刪除無用stroke和fillattrs
                { cleanupIDs: true } // 刪除未使用的和縮小使用的ID
            ]
        }))
        .pipe(gulp.dest('./'));
});

gulp.task('chinese2unicode2min', ['moveFile'], function () {
    return gulp.src('./channel_list_data.json')
        .pipe(strToUnicode())
        .pipe(jsonmin())
        .pipe(gulp.dest('./'));
});

gulp.task('rev', ['cssnano', 'imagemin', 'chinese2unicode2min'], function() {
    return gulp.src(
            ["./{css,image}/**/*"], { base: "./" }
        )
        .pipe(rev())
        .pipe(revDel())
        .pipe(gulp.dest("./"))
        .pipe(rev.manifest())
        .pipe(gulp.dest("./"));
});

gulp.task('revCollectorCss', ['rev'], function() {
    return revCollectorFile = gulp.src([
            "./rev-manifest.json",
            "./css/**/*.css"
        ])
        .pipe(revCollector())
        .pipe(gulp.dest("./css"));
});

gulp.task('revCollectorJson', ['rev'], function() {
    return revCollectorFile = gulp.src([
            "./rev-manifest.json",
            "./channel_list_data.json"
        ])
        .pipe(revCollector())
        .pipe(gulp.dest("./"));
});

gulp.task('watch', ['revCollectorCss','revCollectorJson'], function() {
    var isRunning = false;
    var watchRunnable = null;
    var printComplete = function() {
        console.log("All Task Complete...");
    };

    printComplete();

    return watch("./src/**/*", function() {
        var run = function() {
            isRunning = true;

            runSequence(["revCollectorCss",'revCollectorJson'], function() {
                isRunning = false;
                printComplete();
            });
        };

        var check = function() {
            clearTimeout(watchRunnable);
            watchRunnable = setTimeout(function() {
                if (isRunning) {
                    check();
                } else {
                    run();
                }
            }, 500);
        };

        if (isRunning) {
            check();
        } else {
            run();
        }
    });
});

gulp.task('default', ['revCollectorCss','revCollectorJson']);