import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {eventDateLabel,validEventDate} from './major-events-format.ts';

test('preserves month, year, and interval precision without inventing days',()=>{
 assert.equal(eventDateLabel({date:'2023-03'}),'2023.03');
 assert.equal(eventDateLabel({date:'2026',period:'春节'}),'2026 年 春节');
 assert.equal(eventDateLabel({date:'2023-11-17',period:'11/17—11/22'}),'2023 年 11/17—11/22');
 assert.equal(eventDateLabel({date:'2026-10-26'}),'2026.10.26');
});
test('validates partial dates and actual calendar days',()=>{
 for(const value of ['2022','2023-03','2024-02-29','2026-10-26'])assert.ok(validEventDate(value),value);
 for(const value of ['2026-00','2026-13','2026-02-29','2024-02-30','2026-04-31','2026-1','not a date'])assert.ok(!validEventDate(value),value);
});
