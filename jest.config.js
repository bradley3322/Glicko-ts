/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'], 
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/src/interfaces/**',
    '!<rootDir>/src/types/**', 
    '!<rootDir>/src/index.ts',
    '!<rootDir>/src/constants.ts', 
  ],
};