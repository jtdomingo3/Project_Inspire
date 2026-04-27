import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

@Pipe({
  name: 'markdown',
  standalone: true
})
export class MarkdownPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    if (!value) {
      return '';
    }

    // Configure marked to be synchronous and handle line breaks
    const html = marked.parse(value, { 
      breaks: true,
      gfm: true
    }) as string;

    // Sanitize the HTML to prevent XSS
    const sanitizedHtml = DOMPurify.sanitize(html);

    // Bypass Angular's security to allow the HTML to be rendered
    return this.sanitizer.bypassSecurityTrustHtml(sanitizedHtml);
  }
}
