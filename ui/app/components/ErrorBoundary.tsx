// GenAI Control Center - Error Boundary Component
// Catches JavaScript errors anywhere in the child component tree

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { Colors } from '@dynatrace/strato-design-tokens';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console (in production, send to monitoring service)
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Flex 
          flexDirection="column" 
          alignItems="center" 
          justifyContent="center" 
          padding={32}
          gap={16}
          style={{ minHeight: 300 }}
        >
          <Surface style={{ 
            padding: 32, 
            maxWidth: 600, 
            width: '100%',
            borderLeft: `4px solid ${Colors.Border.Critical.Default}`
          }}>
            <Flex flexDirection="column" gap={16}>
              <Flex alignItems="center" gap={12}>
                <span style={{ fontSize: 32 }}>⚠️</span>
                <Heading level={4}>Something went wrong</Heading>
              </Flex>
              
              <Text style={{ color: Colors.Text.Neutral.Subdued }}>
                An unexpected error occurred in this component. This has been logged for investigation.
              </Text>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <Surface style={{ 
                  padding: 12, 
                  backgroundColor: 'var(--dt-colors-background-default-secondary)',
                  borderRadius: 4,
                  overflow: 'auto',
                  maxHeight: 200
                }}>
                  <Text textStyle="small" style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack && (
                      <>
                        {'\n\nComponent Stack:'}
                        {this.state.errorInfo.componentStack}
                      </>
                    )}
                  </Text>
                </Surface>
              )}

              <Flex gap={12}>
                <Button variant="emphasized" onClick={this.handleReset}>
                  Try Again
                </Button>
                <Button variant="default" onClick={this.handleReload}>
                  Reload Page
                </Button>
              </Flex>
            </Flex>
          </Surface>
        </Flex>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
