// Dynatrace Intelligence Response Renderer with Collapsible Sections
// Shows results prominently while making analysis details collapsible

import React, { useState } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Text, Heading } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { Colors } from '@dynatrace/strato-design-tokens';

interface DavisResponseProps {
  content: string;
}

interface ParsedSection {
  type: 'title' | 'explanation' | 'dql' | 'results' | 'text';
  content: string;
  title?: string;
}

/**
 * Parse the Dynatrace Intelligence markdown response into structured sections
 */
function parseResponse(content: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const lines = content.split('\n');
  
  let currentSection: ParsedSection | null = null;
  let inCodeBlock = false;
  let codeContent: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Handle code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        if (currentSection?.type === 'dql') {
          currentSection.content = codeContent.join('\n');
          sections.push(currentSection);
          currentSection = null;
        }
        inCodeBlock = false;
        codeContent = [];
      } else {
        // Start of code block
        inCodeBlock = true;
        currentSection = { type: 'dql', content: '', title: 'Generated DQL' };
      }
      continue;
    }
    
    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }
    
    // Handle main title (## Dynatrace Intelligence Analysis)
    if (line.startsWith('## ')) {
      if (currentSection && currentSection.content.trim()) {
        sections.push(currentSection);
      }
      sections.push({ type: 'title', content: line.replace('## ', '').trim() });
      currentSection = null;
      continue;
    }
    
    // Handle Query Explanation section
    if (line.startsWith('**Query Explanation**:') || line.startsWith('**Query Explanation**')) {
      if (currentSection && currentSection.content.trim()) {
        sections.push(currentSection);
      }
      const explanationContent = line.replace('**Query Explanation**:', '').replace('**Query Explanation**', '').trim();
      currentSection = { type: 'explanation', content: explanationContent, title: 'Query Explanation' };
      continue;
    }
    
    // Handle Generated DQL label
    if (line.startsWith('**Generated DQL**:') || line.startsWith('**Generated DQL**')) {
      if (currentSection && currentSection.content.trim()) {
        sections.push(currentSection);
      }
      currentSection = null;
      continue;
    }
    
    // Handle Results section
    if (line.startsWith('### Results') || line.startsWith('### ') && line.includes('record')) {
      if (currentSection && currentSection.content.trim()) {
        sections.push(currentSection);
      }
      currentSection = { type: 'results', content: line + '\n', title: 'Results' };
      continue;
    }
    
    // Handle "No data found" - important message
    if (line.includes('No data found') || line.includes('Ensure your AI services')) {
      if (currentSection && currentSection.content.trim()) {
        sections.push(currentSection);
      }
      sections.push({ type: 'results', content: line, title: 'Results' });
      currentSection = null;
      continue;
    }
    
    // Accumulate content to current section or create text section
    if (currentSection) {
      currentSection.content += (currentSection.content ? '\n' : '') + line;
    } else if (line.trim()) {
      currentSection = { type: 'text', content: line };
    }
  }
  
  // Push remaining section
  if (currentSection && currentSection.content.trim()) {
    sections.push(currentSection);
  }
  
  return sections;
}

/**
 * Collapsible section component
 */
const CollapsibleSection: React.FC<{
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  variant?: 'default' | 'code';
}> = ({ title, children, defaultExpanded = false, variant = 'default' }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  return (
    <Surface style={{ 
      padding: 0, 
      marginBottom: 8,
      backgroundColor: 'rgba(0,0,0,0.02)',
      border: '1px solid rgba(0,0,0,0.05)',
      borderRadius: 4,
      overflow: 'hidden',
    }}>
      <Button
        variant="default"
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          padding: '8px 12px',
          justifyContent: 'flex-start',
          borderRadius: 0,
          backgroundColor: expanded ? 'rgba(0,0,0,0.03)' : 'transparent',
        }}
      >
        <Flex alignItems="center" gap={8}>
          <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {expanded ? '▼' : '▶'}
          </Text>
          <Text textStyle="small" style={{ fontWeight: 500, color: Colors.Text.Neutral.Subdued }}>
            {title}
          </Text>
        </Flex>
      </Button>
      {expanded && (
        <div style={{ 
          padding: '8px 12px',
          backgroundColor: variant === 'code' ? 'rgba(0,0,0,0.04)' : 'transparent',
        }}>
          {children}
        </div>
      )}
    </Surface>
  );
};

/**
 * Render a line of markdown text as inline React elements.
 * Handles **bold**, *italic*, `code`, and [links](url).
 */
function renderInlineMarkdown(line: string, keyPrefix: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = line;
  let idx = 0;

  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(remaining)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(remaining.slice(lastIndex, match.index));
    }
    if (match[2]) {
      // **bold**
      parts.push(<strong key={`${keyPrefix}-b${idx++}`}>{match[2]}</strong>);
    } else if (match[3]) {
      // *italic*
      parts.push(<em key={`${keyPrefix}-i${idx++}`}>{match[3]}</em>);
    } else if (match[4]) {
      // `code`
      parts.push(
        <code key={`${keyPrefix}-c${idx++}`} style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 3, fontSize: '0.9em', fontFamily: 'monospace' }}>
          {match[4]}
        </code>
      );
    } else if (match[5] && match[6]) {
      // [text](url)
      parts.push(
        <a key={`${keyPrefix}-a${idx++}`} href={match[6]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--dt-colors-text-primary-default)' }}>
          {match[5]}
        </a>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < remaining.length) {
    parts.push(remaining.slice(lastIndex));
  }

  return parts.length === 0 ? line : parts;
}

/**
 * Render markdown content into React elements.
 * Supports headings, bold, italic, code blocks, inline code, lists, and links.
 */
function renderMarkdown(md: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = md.split('\n');
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let listItems: React.ReactNode[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      nodes.push(
        <ul key={`ul-${nodes.length}`} style={{ margin: '4px 0', paddingLeft: 20 }}>
          {listItems}
        </ul>
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        nodes.push(
          <pre key={`code-${i}`} style={{ fontFamily: 'monospace', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: '4px 0', backgroundColor: 'rgba(0,0,0,0.04)', padding: 8, borderRadius: 4 }}>
            {codeLines.join('\n')}
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) { codeLines.push(line); continue; }

    // Headings
    if (line.startsWith('### ')) { flushList(); nodes.push(<Heading key={`h3-${i}`} level={6} style={{ marginTop: 8 }}>{line.slice(4)}</Heading>); continue; }
    if (line.startsWith('## '))  { flushList(); nodes.push(<Heading key={`h2-${i}`} level={5} style={{ marginTop: 8 }}>{line.slice(3)}</Heading>); continue; }
    if (line.startsWith('# '))   { flushList(); nodes.push(<Heading key={`h1-${i}`} level={4} style={{ marginTop: 8 }}>{line.slice(2)}</Heading>); continue; }

    // List items (- or * or numbered)
    const listMatch = line.match(/^\s*([-*]|\d+\.)\s+(.*)/);
    if (listMatch) {
      listItems.push(<li key={`li-${i}`} style={{ fontSize: 13, lineHeight: 1.6 }}>{renderInlineMarkdown(listMatch[2], `li-${i}`)}</li>);
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) { flushList(); nodes.push(<hr key={`hr-${i}`} style={{ border: 'none', borderTop: '1px solid var(--dt-colors-border-neutral-default)', margin: '8px 0' }} />); continue; }

    // Blank line
    if (!line.trim()) { flushList(); continue; }

    // Regular paragraph
    flushList();
    nodes.push(<Text key={`p-${i}`} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 13 }}>{renderInlineMarkdown(line, `p-${i}`)}</Text>);
  }

  flushList();
  return nodes;
}

/**
 * Main Davis Response component
 */
export const DavisResponse: React.FC<DavisResponseProps> = ({ content }) => {
  const sections = parseResponse(content);
  
  // Check if this is a Dynatrace Intelligence response (has explanation/DQL sections)
  const hasDavisStructure = sections.some(s => s.type === 'explanation' || s.type === 'dql');
  
  // If not a structured Davis response, render markdown
  if (!hasDavisStructure) {
    return (
      <Flex flexDirection="column" gap={4}>
        {renderMarkdown(content)}
      </Flex>
    );
  }
  
  // Find result/output sections to show prominently
  const resultSections = sections.filter(s => s.type === 'results');
  const hasNoData = resultSections.some(s => s.content.includes('No data found'));
  
  return (
    <Flex flexDirection="column" gap={8}>
      {/* Title */}
      {sections.filter(s => s.type === 'title').map((section, idx) => (
        <Heading key={`title-${idx}`} level={6}>
          {section.content}
        </Heading>
      ))}
      
      {/* RESULTS FIRST - Most important information */}
      {resultSections.length > 0 && (
        <Surface style={{ 
          padding: 12, 
          backgroundColor: hasNoData ? 'rgba(255, 100, 0, 0.08)' : 'rgba(99, 102, 241, 0.08)',
          borderRadius: 4,
          marginBottom: 8,
        }}>
          <Flex flexDirection="column" gap={4}>
            <Text textStyle="small" style={{ 
              fontWeight: 600, 
              color: hasNoData ? Colors.Text.Warning.Default : Colors.Text.Primary.Default 
            }}>
              {hasNoData ? '⚠️ Output' : '📊 Output'}
            </Text>
            {resultSections.map((section, idx) => (
              <div key={`result-${idx}`}>
                {renderMarkdown(section.content)}
              </div>
            ))}
          </Flex>
        </Surface>
      )}
      
      {/* Collapsible: Query Explanation */}
      {sections.filter(s => s.type === 'explanation').map((section, idx) => (
        <CollapsibleSection 
          key={`exp-${idx}`}
          title="📖 Query Explanation (click to expand)"
          defaultExpanded={false}
        >
          <Text textStyle="small" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {section.content}
          </Text>
        </CollapsibleSection>
      ))}
      
      {/* Collapsible: Generated DQL */}
      {sections.filter(s => s.type === 'dql').map((section, idx) => (
        <CollapsibleSection 
          key={`dql-${idx}`}
          title="🔍 Generated DQL (click to expand)"
          defaultExpanded={false}
          variant="code"
        >
          <pre style={{ 
            fontFamily: 'monospace', 
            fontSize: 11,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            margin: 0,
            backgroundColor: 'rgba(0,0,0,0.03)',
            padding: 8,
            borderRadius: 4,
          }}>
            {section.content}
          </pre>
        </CollapsibleSection>
      ))}
      
      {/* Any other text sections */}
      {sections.filter(s => s.type === 'text').map((section, idx) => (
        <div key={`text-${idx}`}>
          {renderMarkdown(section.content)}
        </div>
      ))}
    </Flex>
  );
};

export default DavisResponse;
