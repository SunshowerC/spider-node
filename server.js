/**
 * Created by Administrator on 2016/8/16.
 */

// 一些依赖库
var http = require("http"),
    url = require("url"),
    superagent = require("superagent"),
    cheerio = require("cheerio"),
    async = require("async"),
    eventproxy = require('eventproxy');
var ep = new eventproxy(),
    urlsArray = [],	//存放爬取网址
    pageUrls = [],	//存放收集文章页面网站
    pageNum = 5;	//要爬取文章的页数
    postNumPerPage = 20; //每页文章数

var catchData = {}; //存储抓取的数据

for(var i=1 ; i<= pageNum ; i++){
    // pageUrls.push('http://www.cnblogs.com/#p'+i);  //网站页数异步获取
    pageUrls.push('http://www.cnblogs.com/?CategoryId=808&CategoryType=%22SiteHome%22&ItemListActionName=%22PostList%22&PageIndex='+ i +'&ParentCategoryId=0');
}
// 主start程序
function start(){
    function onRequest(req, res){
        // 设置字符编码(去掉中文会乱码)
        res.writeHead(200, {'Content-Type': 'application/json;charset=utf-8'});
        // 轮询 所有文章列表页，获取每页 各个文章 的url , 全部完成后 通过ep触发 BlogArticleHtml
        pageUrls.forEach(function(pageUrl){
            superagent.get(pageUrl)
                .end(function(err,pres){
                    // pres.text 里面存储着请求返回的 html 内容，将它传给 cheerio.load 之后
                    // 就可以得到一个实现了 jquery 接口的变量，我们习惯性地将它命名为 `$`
                    // 剩下就都是利用$ 使用 jquery 的语法了
                    var $ = cheerio.load(pres.text);
                    var curPageUrls = $('.titlelnk');
                    for(var i = 0 ; i < curPageUrls.length ; i++){
                        var articleUrl = curPageUrls.eq(i).attr('href');
                        urlsArray.push(articleUrl);
                        // 相当于一个计数器
                        ep.emit('BlogArticleHtml', articleUrl);
                    }
                });
        });


        /*     简单粗暴版 
        ep.after('BlogArticleHtml', pageUrls.length*postNumPerPage ,function(articleUrls){
            // 当所有 'BlogArticleHtml' 事件完成后的回调触发下面事件
            // ...
            res.write('<br />');
            res.write('articleUrls.length is   ' + articleUrls.length + '<br />' );
            articleUrls.forEach(function (item) {
                res.write('articleUrl is  ' + item + "<br / >");
            });
            res.end();

        });*/
        
        //控制并发版
        ep.after('BlogArticleHtml',pageUrls.length*postNumPerPage,function(articleUrls){
            // 当所有 'BlogArticleHtml' 事件完成后的回调触发下面事件
            // 控制并发数
            var curCount = 0;

            //获取用户信息
            var personInfo = function (blogInfoUrl,blogUser,url) {
                superagent.get(blogInfoUrl)
                    .end(function(err,sres){
                        //获取昵称，园龄，粉丝，关注
                        var $ = cheerio.load(sres.text);
                        var $a = $('#profile_block').find('a');

                        catchData[blogUser] = {};
                        catchData[blogUser].articleUrl = url;
                        catchData[blogUser].nickname = $a.eq(0).text();
                        catchData[blogUser].age = $a.eq(1).text();
                        catchData[blogUser].follower = $a.eq(2).text();
                        catchData[blogUser].followee = $a.eq(3).text();
                    })
            };
            
            var reptileMove = function(url,callback){
                //延迟毫秒数(1000毫秒以内)
                var delay = parseInt((Math.random() * 30000000) % 1000, 10);
                curCount++;
                console.log('现在的并发数是', curCount, '，正在抓取的是', url, '，耗时' + delay + '毫秒');

                //抓取文章URL网页内容，保存HTML内容
                superagent.get(url)
                    .end(function(err,sres){
                        // sres.text 里面存储着请求返回的 html 内容 （此处为每篇文章的点进去的详情内容）
                        var $ = cheerio.load(sres.text);
                        // 收集数据
                        // 拼接URL
                        var currentBlogApp = url.split('/p/')[0].split('/')[3],
                        //通过appUrl请求 获取文章个人信息（此项自行通过network查找xhr请求得出规律 ）
                            appUrl = "http://www.cnblogs.com/mvc/blog/news.aspx?blogApp="+ currentBlogApp;

                        // 具体收集函数
                        personInfo(appUrl,currentBlogApp,url);
                    });

                setTimeout(function() {
                    curCount--;
                    callback(null,url +'Call back content');
                }, delay);
            };


            // 使用async控制异步抓取
            // mapLimit(arr, limit, iterator, [callback])
            // 异步回调
            // articleUrls-{array}-全部文章链接; url-每篇文章的链接
            async.mapLimit(articleUrls, 5 ,function (url, callback) {
                reptileMove(url, callback);
            }, function (err,result) {
                // 4000 个 URL 访问完成的回调函数
                // ...
                console.log("get all data done");
                console.log(result);
                res.end(JSON.stringify(catchData));
            });
        });


    }

    http.createServer(onRequest).listen(3000);
}
exports.start= start;


