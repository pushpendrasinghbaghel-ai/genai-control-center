// Davis CoPilot Response Renderer with Collapsible Sections
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
 * Parse the Davis CoPilot markdown response into structured sections
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
    
    // Handle main title (## Davis CoPilot Analysis)
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
 * Main Davis Response component
 */
export const DavisResponse: React.FC<DavisResponseProps> = ({ content }) => {
  const sections = parseResponse(content);
  
  // Check if this is a Davis CoPilot response (has explanation/DQL sections)
  const hasDavisStructure = sections.some(s => s.type === 'explanation' || s.type === 'dql');
  
  // If not a structured Davis response, render as plain text
  if (!hasDavisStructure) {
    return (
      <Text style={{ whiteSpace: 'pre-wrap' }}>
        {content}
      </Text>
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
              <Text key={`result-${idx}`} style={{ whiteSpace: 'pre-wrap' }}>
                {section.content}
              </Text>
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
        <Text key={`text-${idx}`} style={{ whiteSpace: 'pre-wrap' }}>
          {section.content}
        </Text>
      ))}
    </Flex>
  );
};

export default DavisResponse;
