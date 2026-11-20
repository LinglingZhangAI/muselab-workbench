import {useRef} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {Download,ExternalLink,X} from "lucide-react";
import type {Asset} from "@/data/assets";
import {AssetImage} from "@/components/gallery";
import {IconButton} from "@/components/ui/icon-button";
export function Modal({open,onClose,title,children,className="",focusOnClose}:{open:boolean;onClose:()=>void;title:string;children:React.ReactNode;className?:string;focusOnClose?:React.RefObject<HTMLElement>}) {
 const previous=useRef<HTMLElement|null>(null);
 return <Dialog.Root open={open} onOpenChange={value=>{if(!value)onClose();}}><Dialog.Portal><Dialog.Overlay className="modal-overlay"/><Dialog.Content className={"modal-content "+className} data-note-scope={/^(brief-modal|codex-work-modal|daily-news-modal)$/.test(className)||undefined} data-note-title={title} onEscapeKeyDown={event=>{if(document.activeElement?.closest('.note-folder-menu'))event.preventDefault();}} onOpenAutoFocus={()=>{previous.current=document.activeElement instanceof HTMLElement?document.activeElement:null;}} onCloseAutoFocus={e=>{e.preventDefault();(focusOnClose?.current||previous.current)?.focus();}}><Dialog.Title className="sr-only">{title}</Dialog.Title><Dialog.Description className="sr-only">按 Escape 关闭，使用 Tab 键在弹窗内导航。</Dialog.Description>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function Preview({asset,onClose}:{asset:Asset|null;onClose:()=>void}) {
 return <Modal open={!!asset} onClose={onClose} title={asset?.title??"图片预览"} className="preview-modal">{asset&&<><div className="preview-topbar"><span>{asset.title}</span><div><a className="icon-button" href={asset.imageUrl} download={asset.title+"."+asset.format.toLowerCase()} aria-label="下载图片" title="下载图片"><Download size={19}/></a><IconButton label="关闭图片预览" onClick={onClose}><X size={21}/></IconButton></div></div><div className="large-preview"><AssetImage asset={asset}/></div><div className="preview-bottom"><span>{asset.width} × {asset.height} · {asset.format}</span><span>{asset.tags.join(" / ")}</span></div></>}</Modal>;
}
