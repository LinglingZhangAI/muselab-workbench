import {useEffect,useState} from 'react';
import {X} from 'lucide-react';
import {useNotes} from '@/lib/notes';
import {Modal} from './dialogs';
import {IconButton} from './ui/icon-button';

export function NoteFolderDialog({open,onClose}:{open:boolean;onClose:()=>void}){
 const store=useNotes(),[name,setName]=useState(''),[error,setError]=useState('');
 useEffect(()=>{if(open){setName('');setError('');}},[open]);
 return <Modal open={open} onClose={onClose} title="新建笔记文件夹" className="add-content-modal"><IconButton label="关闭新建笔记文件夹" className="help-close" onClick={onClose}><X size={19}/></IconButton><h2>新建笔记文件夹</h2><form className="new-folder-form" onSubmit={event=>{event.preventDefault();const message=store.createFolder(name);if(message)setError(message);else onClose();}}><label htmlFor="note-folder-name">文件夹名称</label><input id="note-folder-name" className="field" required maxLength={40} value={name} onChange={event=>{setName(event.target.value);setError('');}} placeholder="例如：产品研究"/>{(error||store.foldersError)&&<p className="import-inline-error" role="alert">{error||store.foldersError}</p>}<div className="add-content-footer"><button type="button" onClick={onClose}>取消</button><button type="submit" className="primary-action" disabled={!store.foldersReadable}>创建文件夹</button></div></form></Modal>;
}
