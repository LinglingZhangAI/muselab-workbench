import publicImport from './pinterest-import.json';
import {uiFolderGroups} from './categories';
export interface Asset {
 id:string; title:string; imageUrl:string; width:number; height:number;
 prompt:string; sourceUrl:string; tags:string[]; folder:string; palette:string[];
 favorite:boolean; deleted:boolean; createdAt:string; format:string;
 pinId?:string;analysisStatus?:'pending'|'complete'|'non-ui'|'error';
}
export interface FolderGroup { id:string; title:string; color:string; children:string[]; }
export const folderGroups:FolderGroup[]=uiFolderGroups;
export const pinterestImportInfo={profile:publicImport.profile,total:publicImport.reportedTotal,count:publicImport.importedCount};
const source="https://github.com/microsoft/fluentui-emoji";
const rows=[
 ["cat","Cat & Starry Night","A dreamy white cat looking up at the starry night sky, low angle view, surreal and soft lighting, digital illustration, ultra-detailed fur texture, pink nose and ears, deep blue background with scattered stars, calm and whimsical atmosphere, cinematic composition, fantasy art style.",640,640,["Prompt","Midjourney"],["#06487D","#14649D","#2385BF","#78B8CF","#BCD8E4","#E9B5CD","#F1F0E5"],"AI 咒语"],
 ["woman","Knitted Daydream","A stylized portrait with soft rounded features and a sculptural bob haircut, pastel pink knitwear, playful floral accents, turquoise studio backdrop, handcrafted 3D character design, tactile textures and diffused studio light.",640,800,["Prompt","3D"],["#699FAF","#ECBCD0","#829A5E","#303C3E","#E6D6C4"],"AI 咒语"],
 ["fox","Autumn Muse","An expressive woodland fox in warm autumn orange, eyes full of curiosity, handcrafted character portrait, soft clay-like surfaces, muted sage background, delicate shadows and whimsical illustration.",640,880,["Prompt","Portrait"],["#AAB5A8","#C77B37","#EBCEAF","#493C36","#EFEEE5"],"插画"],
 ["owl","A Quiet Little Soul","A charming owl with oversized thoughtful eyes, a sculptural character study on a muted teal backdrop, soft feather detail, warm earthy colors, gentle studio lighting, whimsical and contemplative mood.",640,850,["Prompt","Character"],["#A3BBB3","#A56739","#DCD5BE","#686651","#C9A998"],"AI 咒语"],
 ["alien","Blueberry Friend","A soft, friendly blue creature with big curious eyes, fuzzy toy-like texture, standing on a pale blush studio backdrop, rounded silhouette, playful character design and soft shadow.",640,640,["Prompt","3D","Character"],["#2B80BC","#92BCD4","#D6BEC5","#2A4767","#F2D9DF"],"AI 咒语"],
 ["penguin","Winter Afternoon","A sweet rounded penguin character wrapped in winter softness, creamy white and charcoal gray, muted mint background, cozy handcrafted toy aesthetic, smooth studio lighting.",640,820,["Prompt","Cozy"],["#B0CBC3","#EAC4AB","#F5EDE2","#394C55","#AAB7B0"],"AI 咒语"],
 ["bear","Strawberry Bear","A small pink teddy bear standing in a bright turquoise studio, simple rounded shape, soft plush material, slightly tilted head, dramatic directional shadow, joyful minimalist 3D illustration.",640,640,["Prompt","3D"],["#58C5C8","#E58596","#F1C4BB","#23758B","#A0DDDE"],"AI 咒语"],
 ["dog","The Goodest Boy","A charming red and rust colored dog with floppy ears and an expressive face, sky blue studio backdrop, tactile soft toy texture, playful proportions, portrait composition.",640,850,["Prompt","Character"],["#7EBED0","#B84247","#D96964","#343636","#D8D9CF"],"AI 咒语"],
 ["rabbit","Little Garden Visitor","An adorable cream rabbit with large pink ears, delicate eyes and tiny paws, soft sage and sandy beige palette, tiny garden setting, whimsical 3D character illustration, gentle natural light.",640,850,["Prompt","3D"],["#D6C9B9","#F0D6C3","#DF9A9B","#A2AF77","#67544A"],"AI 咒语"],
 ["unicorn","Sugar Cloud","A pastel unicorn with a luminous mane, soft peach and lilac palette, clean cream studio backdrop, a dreamy collectible toy, rounded sculptural design and pearlescent accents.",640,850,["Prompt","Fantasy"],["#C6AAC1","#F5D4D4","#E2C0A3","#F7E3CB","#9DAAC6"],"AI 咒语"],
 ["frog","Pond Daydream","A tiny green frog with oversized glossy eyes, seated on a muted lavender backdrop, soft peach belly, sculptural toy-like shapes, tender expression and diffused studio lighting.",640,640,["Prompt","3D"],["#ACA2C8","#B6D68F","#ECC6BC","#849D78","#D4C9E7"],"AI 咒语"],
 ["astronaut","Somewhere Beyond","A retro astronaut exploring a pastel desert, pale coral sand dunes, turquoise sky, creamy white space suit with pink accents and a glossy dark visor, surreal dreamy composition, cinematic soft light.",640,850,["Prompt","Midjourney","Space"],["#8AC7C8","#E9AB94","#F5E3CB","#233F52","#BC767B"],"AI 咒语"],
 ["butterfly","Wings of Wonder","A delicate butterfly in a lavender dreamscape, luminous sky blue wings, soft macro perspective, magical fine details, serene and airy atmosphere.",640,700,["Prompt","Nature"],["#BCA4CB","#52ADDC","#D9BEDE","#F1DCD7","#456289"],"插画"],
 ["cat-two","Moonlit Companion","A quiet cat in warm moonlight, cream fur and pale pink details, lavender studio scene, simple rounded character illustration with a warm playful mood.",640,710,["3D","Cozy"],["#C2BBD0","#E7C8BC","#EDE6D9","#667796","#AD94A9"],"游戏概念"],
 ["bear-two","Soft Sunday","A thoughtful teddy bear in muted rose and sand tones, subtle fabric texture, minimal warm studio setting, cozy illustration and gentle shadows.",640,790,[],["#C6ADA8","#CF9B92","#F4D9C5","#746A66","#BFA7A1"],"AI 咒语"],
 ["fox-two","A Forest Story","A curious fox on a peach studio backdrop, collectible sculpted character, soft tactile finish, warm terracotta and cream color palette, delicate rim lighting.",640,700,["Character"],["#D1ACA4","#CC8047","#F0D7BD","#785C48","#DFB7A9"],"未分类"]
] as const;
export const demoAssets:Asset[]=rows.map((row,index)=>({
 id:row[0],title:row[1],prompt:row[2],width:row[3],height:row[4],tags:[...row[5]],palette:[...row[6]],folder:row[7],
 imageUrl:import.meta.env.BASE_URL+"assets/"+row[0]+".webp",sourceUrl:source,favorite:index===1||index===8,deleted:false,
 createdAt:"2026-10-19",format:"WEBP"
}));
export const initialAssets:Asset[]=demoAssets;
