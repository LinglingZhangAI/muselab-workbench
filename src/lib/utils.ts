import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs:ClassValue[]){return twMerge(clsx(inputs));}
export async function copyText(value:string) {
 if (!navigator.clipboard?.writeText) throw new Error("当前浏览器不支持剪贴板，请手动复制");
 await navigator.clipboard.writeText(value);
}
