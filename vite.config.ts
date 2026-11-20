import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { promptApi } from "./server/prompt-api";
import { pinterestApi } from './server/pinterest-api';
import { imageImportApi } from './server/image-import-api';
import {newsApi} from './server/news-api';
import {briefApi} from './server/brief-api';
import {weatherApi} from './server/weather-api';
import {articlesApi} from './server/articles-api';
import {noteRewriteApi} from './server/note-rewrite-api';
import {podcastsApi} from './server/podcasts-api';
import {noteImagesApi} from './server/note-images-api';
import {podcastTranscriptApi} from './server/podcast-transcript-api';
import {buildersApi} from './server/builders-api';
import {productResearchApi} from './server/product-research-api';
import {majorEventsApi} from './server/major-events-api';
export default defineConfig(({mode})=>({
 plugins:[majorEventsApi(fileURLToPath(new URL('.',import.meta.url))),react(),tailwindcss(),productResearchApi(fileURLToPath(new URL('.',import.meta.url))),buildersApi(fileURLToPath(new URL('.',import.meta.url))),podcastTranscriptApi(fileURLToPath(new URL('.',import.meta.url))),noteImagesApi(fileURLToPath(new URL('.',import.meta.url))),podcastsApi(fileURLToPath(new URL('.',import.meta.url))),noteRewriteApi(fileURLToPath(new URL('.',import.meta.url))),articlesApi(fileURLToPath(new URL('.',import.meta.url))),weatherApi(fileURLToPath(new URL('.',import.meta.url))),briefApi(fileURLToPath(new URL('.',import.meta.url))),newsApi(fileURLToPath(new URL('.',import.meta.url))),imageImportApi(fileURLToPath(new URL('.',import.meta.url))),pinterestApi(fileURLToPath(new URL('.',import.meta.url))),promptApi({...loadEnv(mode,process.cwd(),''),...Object.fromEntries(Object.entries(process.env).filter((entry):entry is [string,string]=>entry[1]!==undefined))})],
 resolve:{alias:{"@":fileURLToPath(new URL("./src",import.meta.url))}}
}));
