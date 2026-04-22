import '@testing-library/jest-dom';
import { vi } from 'vitest';

// 全局 Mock：fetch
global.fetch = vi.fn();

// 全局 Mock：window.location (用于验证跳转)
const originalLocation = window.location;
// @ts-ignore
delete window.location;
window.location = { ...originalLocation, href: '', assign: vi.fn() };
