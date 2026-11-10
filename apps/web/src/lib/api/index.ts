import { DATA_MODE } from '../config';
import { demoSource } from './demo';
import { httpSource } from './http';
import type { DataSource } from './types';

export const api: DataSource = DATA_MODE === 'api' ? httpSource : demoSource; // demo and static both run in the browser
export * from './types';
