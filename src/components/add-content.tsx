import {useEffect,useRef,useState} from 'react';
import {ClipboardPaste,FolderPlus,ImagePlus,Upload,X} from 'lucide-react';
import {Modal} from './dialogs';
import {IconButton} from './ui/icon-button';
export function AddContent({open,onClose,onFiles,onCreateFolder,onError,folderLabel,busy,initialMode='add'}:{open:boolean;onClose:()=>void;onFiles:(files:File[])=>void;onCreateFolder:(name:string)=>string|undefined;onError:(message:string)=>void;folderLabel:string;busy:boolean;initialMode?:'add'|'folder'|'paste'}){
 const [mode,setMode]=useState<'add'|'folder'|'paste'>('add');
 const [name,setName]=useState('');const [error,setError]=useState('');
 const files=useRef<HTMLInputElement>(null);const paste=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(open){setMode(initialMode);setName('');setError('');}},[open,initialMode]);
 useEffect(()=>{if(mode==='paste')paste.current?.focus();},[mode]);
 async function readClipboard(){
  setMode('paste');setError('');
  try{
   if(!navigator.clipboard?.read){setError('请在下方区域按 ⌘V 或 Ctrl+V 粘贴图片');return;}
   const items=await navigator.clipboard.read();const images:File[]=[];
   for(const item of items){const type=item.types.find(t=>t.startsWith('image/'));if(type)images.push(new File([await item.getType(type)],'粘贴图片.png',{type}));}
   if(!images.length){setError('剪贴板里没有图片，请先复制图片或截图');return;}
   onFiles(images);onClose();
  }catch{setError('可点击下方区域，按 ⌘V 或 Ctrl+V 粘贴图片');paste.current?.focus();}
 }
 return <Modal open={open} onClose={onClose} title={mode==='folder'?'新建文件夹':'添加内容'} className="add-content-modal">
  <IconButton label="关闭添加内容" className="help-close" onClick={onClose}><X size={19}/></IconButton>
  <h2>{mode==='folder'?'新建文件夹':mode==='paste'?'粘贴图片':'添加到 Muselab'}</h2>
  {mode==='folder'?<form className="new-folder-form" onSubmit={e=>{e.preventDefault();const message=onCreateFolder(name);if(message)setError(message);else onClose();}}>
   <label htmlFor="new-folder-name">文件夹名称</label><input autoFocus id="new-folder-name" className="field" value={name} maxLength={40} onChange={e=>{setName(e.target.value);setError('');}} placeholder="例如：登录页灵感"/>
   {error&&<p className="import-inline-error" role="alert">{error}</p>}<div className="add-content-footer"><button type="button" onClick={()=>{setMode('add');setError('');}}>返回</button><button type="submit" className="primary-action">创建文件夹</button></div>
  </form>:<>
   <p className="add-content-description">图片将保存到「{folderLabel}」</p>
   {mode==='add'&&<div className="add-actions">
    <button onClick={()=>{setMode('folder');setError('');}}><FolderPlus size={21}/><span>新建文件夹<small>整理你的灵感与参考</small></span></button>
    <button onClick={()=>files.current?.click()} disabled={busy}><ImagePlus size={21}/><span>本地上传<small>选择一张或多张图片</small></span></button>
    <button onClick={()=>void readClipboard()} disabled={busy}><ClipboardPaste size={21}/><span>粘贴图片<small>从剪贴板添加图片或截图</small></span></button>
   </div>}
   <div className="paste-drop-zone" ref={paste} tabIndex={0} role="group" aria-label="图片粘贴区域" onPaste={e=>{
    const images=Array.from(e.clipboardData.files).filter(f=>f.type.startsWith('image/'));
    if(images.length){e.preventDefault();e.stopPropagation();onFiles(images);onClose();}else if(mode==='paste'){e.preventDefault();setError('请复制图片本身，或使用本地上传');}
   }}><Upload size={23} strokeWidth={1.4}/><span>拖入图片，或在这里按 ⌘V / Ctrl+V</span><small>PNG、JPG、WebP、AVIF · 每张不超过 3 MB</small></div>
   {error&&<p className="import-inline-error" role="status">{error}</p>}
   {mode==='paste'&&<button className="paste-back" onClick={()=>{setMode('add');setError('');}}>返回添加菜单</button>}
  </>}
  <input className="sr-only" type="file" ref={files} multiple accept="image/png,image/jpeg,image/webp,image/avif" aria-label="选择本地上传图片" onChange={e=>{const selected=Array.from(e.target.files||[]);if(selected.length){onFiles(selected);onClose();}e.target.value='';}} onError={()=>onError('无法打开图片，请重试')}/>
 </Modal>;
}
