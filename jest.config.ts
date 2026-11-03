import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import ts from 'typescript';

// Path aliases (e.g. the ones added by `nest g library`) live in tsconfig.json,
// so they are read from there instead of being duplicated here.
const { config: tsconfig } = ts.readConfigFile(
  './tsconfig.json',
  ts.sys.readFile,//sys to obiekt systemowy TypeScript, który zawiera funkcje do odczytu plików, itp.
);
const paths = tsconfig?.compilerOptions?.paths ?? {};//to pobiera aliasy ścieżek z tsconfig.json, jeśli istnieją, w przeciwnym razie używa pustego obiektu

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  extensionsToTreatAsEsm: ['.ts'],//to oznacza, że pliki .ts będą traktowane jako moduły ESM
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ESNext',
          moduleResolution: 'Bundler',//to oznacza, że TypeScript będzie używał strategii rozwiązywania modułów Bundler
        },
      },
    ],
  },
  moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),
  collectCoverageFrom: [
    'src/**/*.(t|j)s',//to oznacza, że pliki TypeScript i JavaScript w katalogu src będą uwzględniane do zbierania pokrycia
    'libs/**/*.(t|j)s',
    'apps/**/*.(t|j)s',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};

export default config;
