// AI Provider Brand Icons
// High-quality SVG icons for major AI/LLM providers

import React from 'react';

// Azure / Microsoft Icon
export const AzureIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg viewBox="0 0 96 96" width={size} height={size}>
    <defs>
      <linearGradient id="azure-gradient" x1="58.97" y1="9.92" x2="26.99" y2="84.14" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#114a8b"/>
        <stop offset="1" stopColor="#0669bc"/>
      </linearGradient>
    </defs>
    <path fill="url(#azure-gradient)" d="M33.34 6.27h26.04L31.8 89.76a5.14 5.14 0 01-4.86 3.51H6.14a5.12 5.12 0 01-4.84-6.76L26.48 9.78a5.14 5.14 0 014.86-3.51z"/>
    <path fill="#0078d4" d="M71.17 60.26H29.88a2.37 2.37 0 00-1.63 4.1l26.53 24.69a5.2 5.2 0 003.53 1.38h23.09z"/>
    <path fill="url(#azure-gradient)" d="M33.34 6.27a5.09 5.09 0 00-4.89 3.66L1.36 86.45a5.12 5.12 0 004.84 6.82h21.24a5.09 5.09 0 004.47-3.52L38.1 72.6l19.43 18.07a5.15 5.15 0 003.28 1.6h22.95L71.84 60.26H41.57L61.62 6.27z" opacity=".25"/>
    <path fill="#50e6ff" d="M66.6 9.76a5.14 5.14 0 00-4.86-3.49H34a5.14 5.14 0 014.86 3.49l25.18 76.73a5.12 5.12 0 01-4.86 6.78h27.74a5.12 5.12 0 004.86-6.78z"/>
  </svg>
);

// OpenAI Icon
export const OpenAIIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="#10a37f">
    <path d="M22.282 9.821a5.985 5.985 0 00-.516-4.91 6.046 6.046 0 00-6.51-2.9A6.065 6.065 0 0012 1.168a6.046 6.046 0 00-5.756 4.185 6.046 6.046 0 00-4.044 2.934 5.985 5.985 0 00.742 7.034 5.985 5.985 0 00.516 4.91 6.046 6.046 0 006.51 2.9A6.065 6.065 0 0012 22.832a6.046 6.046 0 005.756-4.185 6.046 6.046 0 004.044-2.934 5.985 5.985 0 00-.518-5.892zM12 20.55a3.77 3.77 0 01-2.42-.877l.12-.067 4.022-2.32a.65.65 0 00.329-.572v-5.666l1.7.982a.06.06 0 01.032.047v4.692A3.8 3.8 0 0112 20.55zm-8.155-3.478a3.77 3.77 0 01-.452-2.533l.12.072 4.022 2.32a.65.65 0 00.658 0l4.91-2.836v1.964a.06.06 0 01-.024.052l-4.065 2.347a3.8 3.8 0 01-5.169-1.386zm-1.062-8.806A3.77 3.77 0 014.77 6.012v4.765a.65.65 0 00.329.571l4.91 2.836-1.7.981a.06.06 0 01-.056.005L4.19 12.823a3.8 3.8 0 01-1.407-5.557zm14.012 3.261l-4.91-2.836 1.7-.981a.06.06 0 01.056-.005l4.063 2.347a3.8 3.8 0 01-.583 6.844v-4.798a.65.65 0 00-.326-.571zm1.691-2.545l-.12-.072-4.022-2.32a.65.65 0 00-.658 0l-4.91 2.836V7.462a.06.06 0 01.024-.052l4.065-2.347a3.8 3.8 0 015.621 3.919zm-10.64 3.5l-1.7-.981a.06.06 0 01-.032-.047V6.762a3.8 3.8 0 016.233-2.913l-.12.067-4.022 2.32a.65.65 0 00-.329.572l-.03 5.674zm.923-1.99l2.187-1.263 2.187 1.263v2.526l-2.187 1.263-2.187-1.263V10.49z"/>
  </svg>
);

// Anthropic / Claude Icon
export const AnthropicIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="#CC785C">
    <path d="M17.304 3H14.29l5.71 18h3.014L17.304 3zm-10.608 0L1 21h3.014l1.252-4.05h6.468L12.986 21H16L10.29 3H6.696zm.782 11.03L9.5 7.586l2.022 6.444H7.478z"/>
  </svg>
);

// Google / Vertex / Gemini Icon
export const GoogleAIIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// AWS Bedrock Icon
export const AWSBedrockIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg viewBox="0 0 80 80" width={size} height={size}>
    <defs>
      <linearGradient id="aws-bedrock-grad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#C8511B"/>
        <stop offset="100%" stopColor="#FF9900"/>
      </linearGradient>
    </defs>
    <path fill="url(#aws-bedrock-grad)" d="M40 0C17.9 0 0 17.9 0 40s17.9 40 40 40 40-17.9 40-40S62.1 0 40 0z"/>
    <path fill="#fff" d="M25 25h30v30H25z" opacity="0.3"/>
    <path fill="#fff" d="M32 32h16v16H32z"/>
    <path fill="#fff" d="M40 20v8M40 52v8M20 40h8M52 40h8" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

// Cohere Icon
export const CohereIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <circle cx="12" cy="12" r="10" fill="#39594D"/>
    <path fill="#D18EE2" d="M7 12c0-2.76 2.24-5 5-5s5 2.24 5 5-2.24 5-5 5"/>
    <circle cx="12" cy="12" r="2.5" fill="#fff"/>
  </svg>
);

// Mistral AI Icon
export const MistralIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <rect x="2" y="2" width="5" height="5" fill="#F7D046"/>
    <rect x="9.5" y="2" width="5" height="5" fill="#F7D046"/>
    <rect x="17" y="2" width="5" height="5" fill="#000"/>
    <rect x="2" y="9.5" width="5" height="5" fill="#F7D046"/>
    <rect x="9.5" y="9.5" width="5" height="5" fill="#EE792F"/>
    <rect x="17" y="9.5" width="5" height="5" fill="#000"/>
    <rect x="2" y="17" width="5" height="5" fill="#000"/>
    <rect x="9.5" y="17" width="5" height="5" fill="#EE792F"/>
    <rect x="17" y="17" width="5" height="5" fill="#000"/>
  </svg>
);

// Meta / Llama Icon
export const MetaIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <path fill="#0668E1" d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/>
  </svg>
);

// Hugging Face Icon
export const HuggingFaceIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <path fill="#FFD21E" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
    <circle cx="8.5" cy="10" r="1.5" fill="#1A1A1A"/>
    <circle cx="15.5" cy="10" r="1.5" fill="#1A1A1A"/>
    <path fill="#1A1A1A" d="M12 17c2.21 0 4-1.34 4-3H8c0 1.66 1.79 3 4 3z"/>
    <path fill="#FF6F00" d="M7 7.5C7 6.67 7.67 6 8.5 6S10 6.67 10 7.5M14 7.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5"/>
  </svg>
);

// IBM watsonx Icon
export const IBMWatsonIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <rect width="24" height="24" rx="4" fill="#0F62FE"/>
    <path fill="#fff" d="M6 8h2v8H6zM10 8h2l1.5 4 1.5-4h2v8h-2v-5l-1.5 4-1.5-4v5h-2z"/>
  </svg>
);

// Nvidia NIM Icon
export const NvidiaIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <path fill="#76B900" d="M8.948 8.798v-1.43c.136-.016.273-.026.414-.026 2.025 0 3.263 1.778 3.263 1.778s-1.504 2.08-3.117 2.08c-.2 0-.39-.022-.56-.066v-2.336zm0-4.804v2.449c.182-.02.368-.034.56-.034 2.726 0 4.503 2.783 4.503 2.783s-2.46 3.284-4.637 3.284c-.15 0-.29-.01-.426-.032v1.027c.127.013.253.02.38.02 3.142 0 5.456-2.32 7.116-3.85.16.13.814.706.944.83-1.746 1.97-5.584 4.005-8.1 4.005-.117 0-.232-.006-.34-.018v1.335H22V4H8.948v.004z"/>
    <path fill="#76B900" d="M2 8.958c1.58-3.08 4.64-4.048 6.948-4.166V4c-3.894.152-7.52 2.33-8.948 5.3v8.356H2V8.958z"/>
  </svg>
);

// Default AI Provider Icon (fallback)
export const DefaultAIIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <defs>
      <linearGradient id="ai-default-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6366F1"/>
        <stop offset="100%" stopColor="#8B5CF6"/>
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="10" fill="url(#ai-default-grad)"/>
    <path fill="#fff" d="M12 6l1.5 3 3.5.5-2.5 2.5.5 3.5-3-1.5-3 1.5.5-3.5-2.5-2.5 3.5-.5z"/>
    <circle cx="12" cy="14" r="2" fill="#fff" opacity="0.5"/>
  </svg>
);

// Get provider icon based on provider name
export const getProviderIcon = (providerName: string, size: number = 24): React.ReactNode => {
  const name = providerName.toLowerCase();
  
  // Azure / Microsoft
  if (name.includes('azure') || name.includes('microsoft')) {
    return <AzureIcon size={size} />;
  }
  
  // OpenAI
  if (name.includes('openai') || name.includes('gpt-') || name.includes('chatgpt') || name.includes('dall-e')) {
    return <OpenAIIcon size={size} />;
  }
  
  // Anthropic / Claude
  if (name.includes('anthropic') || name.includes('claude')) {
    return <AnthropicIcon size={size} />;
  }
  
  // Google / Vertex / Gemini / PaLM
  if (name.includes('google') || name.includes('vertex') || name.includes('gemini') || name.includes('palm') || name.includes('bard')) {
    return <GoogleAIIcon size={size} />;
  }
  
  // AWS / Bedrock
  if (name.includes('aws') || name.includes('amazon') || name.includes('bedrock')) {
    return <AWSBedrockIcon size={size} />;
  }
  
  // Cohere
  if (name.includes('cohere')) {
    return <CohereIcon size={size} />;
  }
  
  // Mistral
  if (name.includes('mistral')) {
    return <MistralIcon size={size} />;
  }
  
  // Meta / Llama
  if (name.includes('meta') || name.includes('llama') || name.includes('facebook')) {
    return <MetaIcon size={size} />;
  }
  
  // Hugging Face
  if (name.includes('hugging') || name.includes('hf') || name.includes('transformers')) {
    return <HuggingFaceIcon size={size} />;
  }
  
  // IBM watsonx
  if (name.includes('ibm') || name.includes('watson')) {
    return <IBMWatsonIcon size={size} />;
  }
  
  // Nvidia NIM
  if (name.includes('nvidia') || name.includes('nim')) {
    return <NvidiaIcon size={size} />;
  }
  
  // Default fallback
  return <DefaultAIIcon size={size} />;
};

// Get icon for a model based on its name (infers provider from model name)
export const getModelIcon = (modelName: string, size: number = 20): React.ReactNode => {
  const name = modelName.toLowerCase();
  
  // OpenAI models
  if (name.includes('gpt') || name.includes('davinci') || name.includes('curie') || 
      name.includes('babbage') || name.includes('ada') || name.includes('text-embedding') ||
      name.includes('whisper') || name.includes('dall-e') || name.includes('o1') || name.includes('o3')) {
    return <OpenAIIcon size={size} />;
  }
  
  // Anthropic / Claude models
  if (name.includes('claude') || name.includes('anthropic')) {
    return <AnthropicIcon size={size} />;
  }
  
  // Google / Gemini / PaLM models
  if (name.includes('gemini') || name.includes('palm') || name.includes('bard') || 
      name.includes('text-bison') || name.includes('chat-bison') || name.includes('gecko')) {
    return <GoogleAIIcon size={size} />;
  }
  
  // Meta / Llama models
  if (name.includes('llama') || name.includes('meta') || name.includes('codellama')) {
    return <MetaIcon size={size} />;
  }
  
  // Mistral models
  if (name.includes('mistral') || name.includes('mixtral')) {
    return <MistralIcon size={size} />;
  }
  
  // Cohere models
  if (name.includes('command') || name.includes('cohere') || name.includes('embed-')) {
    return <CohereIcon size={size} />;
  }
  
  // AWS Bedrock / Titan models
  if (name.includes('titan') || name.includes('bedrock')) {
    return <AWSBedrockIcon size={size} />;
  }
  
  // Azure models
  if (name.includes('azure')) {
    return <AzureIcon size={size} />;
  }
  
  // Default AI model icon
  return <DefaultAIIcon size={size} />;
};

// Export all icons for direct use
export const ProviderIcons = {
  Azure: AzureIcon,
  OpenAI: OpenAIIcon,
  Anthropic: AnthropicIcon,
  Google: GoogleAIIcon,
  AWS: AWSBedrockIcon,
  Cohere: CohereIcon,
  Mistral: MistralIcon,
  Meta: MetaIcon,
  HuggingFace: HuggingFaceIcon,
  IBM: IBMWatsonIcon,
  Nvidia: NvidiaIcon,
  Default: DefaultAIIcon,
};
