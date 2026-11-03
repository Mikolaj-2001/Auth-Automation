import { jest as jestGlobals } from '@jest/globals';

Object.assign(globalThis, { jest: jestGlobals });//to pomaga w używaniu globalnego obiektu jest w testach, bez konieczności importowania go w każdym pliku testowym
