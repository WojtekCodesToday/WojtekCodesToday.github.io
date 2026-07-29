# what did i change?

a lot of things for the incomprehensible reading people, thanks :)
<hr>

## 1.

so i've basically made the website dynamic
so instead of loading HTML files, the pages are actually javascript files,

i know it sounds weird,
however i am not a big favor on the idea of making every "page"
into one "bundled script" made by a "bundler"

<br>

oh and it's using a [npm library i've made](https://npmjs.com/roostjs)
instead of some library like [React.js](https://react.dev)

<br>

what i am using from React however is [JSX](https://en.wikipedia.org/wiki/JavaScript_XML), by using [Babel](https://babeljs.io),
and a bit of changes to how Babel should handle it.

i've basically made Babel use my library's function instead of React's!

<br>

but generally the website should *feel* a bit faster than before...

## 2.

the manga file size has been decreasing by the months.

this is because i've actually made a file format for it which was originally in C,


(it's a bit complicated for me to explain myself in detail, except that i use a lot of stuff from JPEG,
and a bit of Huffman there and there...)


but i've ported the loading script in JS

<br>

the only downside is quality (and it's a bit messy internally), however i haven't found a proper solution except "upscalers".

and if asking what's the size of a regular chapter, it's like... 500-700 kilobytes (kB),

which is enough to fit on a [floppy disk](https://en.wikipedia.org/wiki/Floppy_disk).