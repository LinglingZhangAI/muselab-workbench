export type NoteImage={src:string;originalUrl:string;alt:string;caption:string};
export function validNoteImage(value:unknown):value is NoteImage{
 const image=value as NoteImage;return !!image&&typeof image.src==='string'&&/^\/assets\/note-images\/[a-f0-9]{24}\.(?:jpg|png|gif|webp|avif)$/.test(image.src)&&typeof image.originalUrl==='string'&&/^https:\/\//.test(image.originalUrl)&&typeof image.alt==='string'&&typeof image.caption==='string';
}
export function imageMarkdown(image:NoteImage,local=false){return `![${(image.alt||'原文配图').replace(/[\[\]\r\n]/g,' ')}](${local?image.src:image.originalUrl})${image.caption?'\n\n'+image.caption:''}`;}
