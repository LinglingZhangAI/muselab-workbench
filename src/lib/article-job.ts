import type {NoteSource} from './notes';
import type {NoteImage} from './note-images';
export type ArticleJob={id:string;status:'reading'|'writing'|'completed'|'failed';message:string;url:string;createdAt:string;completedAt?:string;title?:string;body?:string;sourceTitle?:string;images?:NoteImage[];source?:NoteSource;episodeId?:string};
