import test from 'node:test';
import assert from 'node:assert/strict';
import { imagePath, imageTarget, imageURL, imageMarkdown, imageMatcher, maxImageSize } from './images.js';
import { github } from './github.js';
const config = {repository:'pato/blog', branch:'main', contentRoot:'notes', contentDir:'notes/posts', imageDir:'notes/images', exclude:['private'], siteBase:'/garden/'};
test('image paths, safe URLs and Markdown retain portable references', () => {
  assert.equal(imagePath(config,{name:'João’s photo.PNG',size:10},'unique'),'notes/images/joao-s-photo-unique.png');
  for(const url of ['javascript:alert(1)','data:image/png;base64,test','//other.org/image','x\\y']) assert.throws(()=>imageURL(url));
  assert.equal(imageMarkdown('images/a b.png','[hello]'),'![\\[hello\\]](<images/a b.png>)');
  assert.throws(()=>imagePath(config,{name:'a.svg',size:10}));
  assert.throws(()=>imagePath(config,{name:'a.png',size:maxImageSize+1}));
  assert(!imageMatcher(config)('notes/private/a.png'));
  assert(!imageMatcher(config)('notes/../a.png'));
});
test('image lookup respects Quartz asset URLs, relative paths and site prefixes',()=>{
  const settings={...config,images:[{path:'notes/images/a b.png',url:'/garden/images/a-b.png'}]};
  assert.deepEqual(imageTarget(settings,'a%20b.png?size=2#x','notes/posts/post.md'),{path:'notes/images/a b.png',url:'/garden/images/a-b.png?size=2#x'});
  assert.equal(imageTarget(settings,'../images/a%20b.png','notes/posts/post.md').url,'/garden/images/a-b.png');
  assert.equal(imageTarget(settings,'/garden/images/a-b.png','notes/posts/post.md').path,'notes/images/a b.png');
  assert.throws(()=>imageTarget(settings,'../../outside.png','notes/posts/post.md'));
  assert.deepEqual(imageTarget(settings,'https://example.org/a.png'),{url:'https://example.org/a.png'});
});
test('binary upload reconciles a lost response without overwrite or another commit',async()=>{
  let bytes, commits=0;
  const request=async (_url,options)=>{
    if(!options.method) return bytes ? new Response(bytes) : new Response('{}',{status:404});
    if(bytes) return new Response('{"message":"already exists"}',{status:422});
    bytes=Buffer.from(JSON.parse(options.body).content,'base64'); commits++;
    throw new TypeError('Response lost');
  };
  const api=github(config,()=> 'sandbox',request);
  const original=Uint8Array.from({length:100000},(_,i)=>i%256);
  await api.saveImage('notes/images/a.png',original);
  assert.deepEqual(new Uint8Array(await (await api.readImage('notes/images/a.png')).arrayBuffer()),original);
  await assert.rejects(api.saveImage('notes/images/a.png',new Uint8Array([1,2])),/already exists/);
  assert.equal(commits,1);
  await assert.rejects(api.saveImage('notes/posts/a.png',original),/directory/);
  await assert.rejects(api.saveImage('notes/private/a.png',original),/outside/);
});
