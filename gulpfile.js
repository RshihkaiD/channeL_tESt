var gulp = require('gulp');
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
var errorHandler = require('gulp-error-handle');
var notifier = require('node-notifier');
var gutil = require('gulp-util');
var through = require('through2');
var pre = require('preprocess');

var logError = function(err) {
    notifier.notify({
        title: 'Error Occured...',
        message: err.toString(),
        timeout: 10
    });
    gutil.log(gutil.colors.red(err));
    gutil.log(gutil.colors.red(err.stack));
    this.emit('end');
};

var strToUnicode = function() {
    var toUnicode = function(s) {
        return s.replace(/([\u4E00-\u9FA5]|[\uFE30-\uFFA0])/g, function(s){
            return '\\u' + s.charCodeAt(0).toString(16);
        });
    };

    return through.obj(function(file, enc, cb) {
        if (file.isNull()) {
            this.push(file);
            return cb();
        }

        if (file.isStream()) {
            this.emit('error', new gutil.PluginError(PLUGIN_NAME, 'Streaming not supported'));
            return cb();
        }

        var content = pre.preprocess(file.contents.toString(), {});

        content = toUnicode(content);

        file.contents = new Buffer(content);

        this.push(file);

        cb();
    });
};

gulp.task('delete', function() {
    var delFolder = gulp.src('./{css,image}')
        .pipe(errorHandler(logError))
        .pipe(vinyl(del));

    var delJson = gulp.src('./channel_list_data.json')
        .pipe(errorHandler(logError))
        .pipe(vinyl(del));

    return merge(delFolder, delJson);
});

gulp.task('moveFile', ['delete'], function() {
    return gulp.src('./src/**/*')
        .pipe(errorHandler(logError))
        .pipe(gulp.dest('./'));
});

gulp.task('cssnano', ['moveFile'], function() {
    return gulp.src("./css/**/*.css")
        .pipe(errorHandler(logError))
        .pipe(cssnano({
            browsers: ['last 2 versions'],
            reduceIdents: false,
            zindex: false // 關閉z-index 設定
        }))
        .pipe(gulp.dest("./css"));
});

gulp.task('imagemin', ['moveFile'], function() {
    return gulp.src('./image/**/*.{jpg,png,svg}')
        .pipe(errorHandler(logError))
        .pipe(imagemin([
            imagemin.gifsicle({ interlaced: true }), // gif無損轉換為漸進式。
            imagemin.jpegtran({ progressive: true }), // jpg無損失轉換為漸進式
            imagemin.optipng({ optimizationLevel: 5 }), // 設定png優化等級，共有0~7級
            imagemin.svgo({
                plugins: [
                    { removeXMLProcInst: true }, // 刪除XML處理指令
                    { removeEmptyAttrs: true }, // 刪除空的屬性
                    { removeHiddenElems: true }, // 刪除隱藏的元素
                    { removeEmptyText: true }, // 刪除空的文本元素
                    { removeEmptyContainers: true }, // 刪除空的容器元素
                    { removeUnusedNS: true }, // 刪除未使用的名稱空間聲明
                    { removeUselessStrokeAndFill: true }, // 刪除無用stroke和fillattrs
                    { cleanupIDs: true } // 刪除未使用的和縮小使用的ID
                ]
            })
        ]))
        .pipe(gulp.dest('./image'));
});

gulp.task('chinese2unicode', ['moveFile'], function() {
    return gulp.src('./channel_list_data.json')
        .pipe(errorHandler(logError))
        .pipe(strToUnicode())
        .pipe(jsonmin())
        .pipe(gulp.dest('./'));
});

gulp.task('rev', ['cssnano', 'imagemin', 'chinese2unicode'], function() {
    return gulp.src(
            ["./{css,image}/**/*"], { base: "./" }
        )
        .pipe(errorHandler(logError))
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
        .pipe(errorHandler(logError))
        .pipe(revCollector())
        .pipe(gulp.dest("./css"));
});

gulp.task('revCollectorJson', ['rev'], function() {
    return revCollectorFile = gulp.src([
            "./rev-manifest.json",
            "./channel_list_data.json"
        ])
        .pipe(errorHandler(logError))
        .pipe(revCollector())
        .pipe(gulp.dest("./"));
});

gulp.task('watch', ['revCollectorCss', 'revCollectorJson'], function() {
    var isRunning = false;
    var watchRunnable = null;
    var printComplete = function() {
        console.log("All Task Complete...");
    };

    printComplete();

    return watch("./src/**/*", function() {
        var run = function() {
            isRunning = true;

            runSequence(["revCollectorCss", 'revCollectorJson'], function() {
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

gulp.task('default', ['revCollectorCss', 'revCollectorJson']);