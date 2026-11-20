import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractRewriteSource,extractTextSource,publicAddress,rewriteUrl,rewriteArticleUrl} from './rewrite-source.ts';
test('rejects private addresses and unsupported URLs',()=>{
 for(const value of ['https://127.0.0.1/','https://[::1]/','https://10.0.0.2/','https://169.254.169.254/','https://localhost/','http://example.com/','https://user:password@example.com/','https://example.com:8000/'])assert.throws(()=>rewriteUrl(value));
 for(const value of ['100.64.0.1','172.16.1.1','192.168.1.1','198.18.1.1','::ffff:127.0.0.1','fc00::1','fe80::1'])assert.equal(publicAddress(value),false);
 assert.equal(publicAddress('93.184.216.34'),true);assert.equal(publicAddress('2606:4700::1111'),true);
});
test('cleans tracking without removing article parameters',()=>assert.equal(rewriteUrl('https://example.com/post?id=4&utm_source=muzli#top').href,'https://example.com/post?id=4'));
test('extracts article text without running or preserving scripts',()=>{
 const text='Meta plans a new share class, according to the report. '.repeat(6);
 const article=extractRewriteSource(`<title>Example</title><article class="entry-content"><p>${text}</p><script>steal()</script><aside>Advertisement</aside><p>More detail.</p></article>`,'https://example.com/post');
 assert.equal(article.title,'Example');assert(article.text.includes(text.trim()));assert(!article.text.includes('steal'));assert(!article.text.includes('Advertisement'));
});
test('does not treat login or challenge pages as an article',()=>assert.throws(()=>extractRewriteSource('<title>Verify</title><main>Verify you are human</main>','https://example.com/')));
test('extracts real article images and captions, deduplicates cover and rejects tracking',()=>{
 const article=extractRewriteSource(`<title>Article</title><meta property="og:image" content="https://example.com/cover.jpg?w=1200"><article class="entry-content"><p>${'文章正文。'.repeat(60)}</p><figure><img src="/cover.jpg?w=600" alt="主图"><figcaption>原图署名</figcaption></figure><figure><img src="https://cdn.example.com/photo.png" alt="正文图"><figcaption>图片署名</figcaption></figure><img src="http://127.0.0.1/image.png"><img width="1" src="https://example.com/pixel.png"></article>`,'https://example.com/post');
 assert.equal(article.images.length,2);assert.equal(article.images[1].alt,'正文图');assert.equal(article.images[1].caption,'图片署名');
});
test('accepts public HTTP, HTTPS, and scheme-less links without relaxing media URL rules',()=>{
 assert.equal(rewriteArticleUrl('http://example.org/post?utm_source=share&id=4').href,'http://example.org/post?id=4');
 assert.equal(rewriteArticleUrl(' example.org/post。 ').href,'https://example.org/post');
 for(const url of ['http://127.0.0.1/','http://[::1]/','http://10.0.0.2/','https://local.localhost/post','file:///etc/passwd','javascript:alert(1)','http://user:pass@example.org/','http://example.org:8000/'])assert.throws(()=>rewriteArticleUrl(url));
 assert.throws(()=>rewriteUrl('http://example.org/photo.jpg'));
});
test('reads public document main content without including menus',()=>{
 const body='Public documentation explains configuration and provides concrete examples. '.repeat(9);
 const article=extractRewriteSource(`<title>Docs</title><nav>${'menu '.repeat(100)}</nav><main><h1>Set up your project</h1><div>${body}</div></main><footer>Copyright footer</footer>`,'https://docs.example.org/setup');
 assert(article.text.includes(body.trim()));assert(!article.text.includes('menu'));assert(!article.text.includes('Copyright footer'));
});
test('recognizes WeChat section layouts and lazy images',()=>{
 const body='这是一篇公开的公众号文章，保留原文中的事实、观点及归属。'.repeat(12);
 const article=extractRewriteSource(`<title>公开文章</title><div id="js_content"><section><span>${body}</span></section><img data-src="https://images.example.org/photo.jpg"></div>`,'https://mp.weixin.qq.com/s/example');
 assert(article.text.includes(body));assert.equal(article.images[0].url,'https://images.example.org/photo.jpg');
});
test('finds generic public prose but avoids a link-heavy menu candidate',()=>{
 const prose='The report describes the launch and includes facts from public sources. '.repeat(10);
 const article=extractRewriteSource(`<title>Report</title><div>${'<p><a href="/a">Navigation link</a></p>'.repeat(100)}</div><section><p>${prose}</p><p>Additional context and facts.</p></section>`,'https://example.org/news');
 assert(article.text.includes(prose.trim()));assert(!article.text.includes('Navigation link'));
});
test('uses structured article body when the layout exposes no usable prose',()=>{
 const body='The full news report provides dates and attributed statements. '.repeat(10);
 const article=extractRewriteSource(`<title>News</title><script type="application/ld+json">${JSON.stringify({'@graph':[{'@type':'NewsArticle',headline:'News',articleBody:body}]})}</script><div id="root"></div>`,'https://example.org/story');
 assert.equal(article.text,body.trim());
});
test('does not treat known paywalls, verification, or empty JS shells as readable articles',()=>{
 const body='Subscriber-only article content. '.repeat(20);
 for(const html of [
  `<title>News</title><script type="application/ld+json">${JSON.stringify({'@type':'NewsArticle',articleBody:body,isAccessibleForFree:false})}</script><article>${body}</article>`,
  `<title>Verify you are human</title><main>${body}</main>`,
  '<title>App</title><div id="root"></div><script>renderApp()</script>'
 ])assert.throws(()=>extractRewriteSource(html,'https://example.org/'));
});
test('reads public Markdown and text documents without inventing title or content',()=>{
 const body='# Public guide\n\n'+('A real document section with public source facts. '.repeat(10));
 const article=extractTextSource(body,'https://example.org/readme.md');
 assert.equal(article.title,'Public guide');assert.equal(article.text,body.trim());assert.deepEqual(article.images,[]);
});

test('recognizes WeChat verification pages and guides the user to provide readable source text',()=>{
 assert.throws(()=>extractRewriteSource('<body><p>环境异常</p><p>完成验证后即可继续访问。</p></body>','https://mp.weixin.qq.com/mp/wappoc_appmsgcaptcha'),/微信要求在浏览器中完成验证/);
});
