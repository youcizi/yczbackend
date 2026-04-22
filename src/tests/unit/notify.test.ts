import { describe, it, expect } from 'vitest';
import { NotifyService } from '../../services/NotifyService';

describe('NotifyService - Unit Tests', () => {
    describe('renderTemplate', () => {
        it('should correctly replace placeholders with real data', () => {
            const template = 'Hello {{name}}, welcome to {{city}}!';
            const data = { name: 'Alice', city: 'Wonderland' };
            const result = NotifyService.renderTemplate(template, data);
            expect(result).toBe('Hello Alice, welcome to Wonderland!');
        });

        it('should handle extra spaces in placeholders', () => {
            const template = 'Hello {{  name  }}!';
            const data = { name: 'Bob' };
            const result = NotifyService.renderTemplate(template, data);
            expect(result).toBe('Hello Bob!');
        });

        it('should replace missing or null keys with an empty string', () => {
            const template = 'Val1: {{v1}}, Val2: {{v2}}';
            const data = { v1: 'exists', v2: null };
            const result = NotifyService.renderTemplate(template, data);
            expect(result).toBe('Val1: exists, Val2: ');
        });

        it('should replace undefined keys with an empty string', () => {
            const template = 'Val: {{missing}}';
            const data = {};
            const result = NotifyService.renderTemplate(template, data);
            expect(result).toBe('Val: ');
        });

        it('should handle multiple occurrences of the same variable', () => {
            const template = '{{name}} is {{name}}';
            const data = { name: 'Alice' };
            const result = NotifyService.renderTemplate(template, data);
            expect(result).toBe('Alice is Alice');
        });

        it('should handle HTML structure in template', () => {
            const template = '<h1>Hi {{name}}</h1><p>Msg: {{msg}}</p>';
            const data = { name: '<b>Alice</b>', msg: 'Line1\nLine2' };
            const result = NotifyService.renderTemplate(template, data);
            expect(result).toBe('<h1>Hi <b>Alice</b></h1><p>Msg: Line1\nLine2</p>');
        });
    });

    describe('buildHtmlTable', () => {
        it('should generate a valid HTML table string', () => {
            const data = { key1: 'val1', key2: 'val2' };
            const html = NotifyService.buildHtmlTable(data);
            expect(html).toContain('<table');
            expect(html).toContain('key1');
            expect(html).toContain('val1');
            expect(html).toContain('key2');
            expect(html).toContain('val2');
        });
    });
});
