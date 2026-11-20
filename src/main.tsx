import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import {DailyPodcasts} from './components/daily-podcasts';
import {SelectionNotes} from './components/notes';
import {NotesProvider} from './lib/notes';
import {PodcastArticlesProvider} from './lib/podcast-articles';
import "./styles.css";
import {initializeCloudStorage} from './lib/cloud-storage';
import {installPagesDemo} from './lib/pages-demo';
if (import.meta.env.MODE === 'pages') {
 installPagesDemo();
 const banner = document.createElement('p');
 banner.className = 'demo-notice';
 banner.textContent = '公开演示 · 使用示例数据';
 document.body.append(banner);
}
void initializeCloudStorage().then(()=>ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><NotesProvider><PodcastArticlesProvider>{new URLSearchParams(location.search).has('podcast')?<><DailyPodcasts standalone/><SelectionNotes/></>:<App/>}</PodcastArticlesProvider></NotesProvider></React.StrictMode>)).catch(error=>{const root=document.getElementById('root')!;root.textContent=error instanceof Error?error.message:'工作台暂时无法读取，请刷新重试。';});
