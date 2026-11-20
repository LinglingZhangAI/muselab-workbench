import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
export function IconButton({label,children,className,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{label:string;children:ReactNode}) {
 return <button type="button" className={cn("icon-button",className)} aria-label={label} title={label} {...props}>{children}</button>;
}
