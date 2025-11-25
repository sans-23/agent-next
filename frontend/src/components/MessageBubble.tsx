import React, { useEffect, useRef, type CSSProperties } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Chart, registerables } from 'chart.js';
import * as Babel from '@babel/standalone';
import { User, Bot } from 'lucide-react';

Chart.register(...registerables);

interface TextBlock { block_type: "text"; text: string; }
interface ReactBlock { block_type: "react"; description?: string; code: string; }
interface LLMOutputBlock { blocks: (TextBlock | ReactBlock)[]; }

type ApiMessageContent = TextBlock | LLMOutputBlock;

interface Message {
  msg: {
    content: ApiMessageContent;
    role: 'user' | 'ai';
  };
}

interface CodeComponentProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const MessageBubble: React.FC<Message> = ({ msg }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  if (!msg.content) {
    return null;
  }

  // Custom style for code blocks to match the theme
  const codeBlockStyle: { [key: string]: CSSProperties } = {
    ...vscDarkPlus,
    'pre[class*="language-"]': {
      ...vscDarkPlus['pre[class*="language-"]'],
      background: 'transparent', // Let CSS handle background
      margin: 0,
      padding: 0,
      border: 'none',
      boxShadow: 'none',
    },
    'code[class*="language-"]': {
      ...vscDarkPlus['code[class*="language-"]'],
      fontFamily: 'var(--font-mono)',
      fontSize: '0.875rem',
    }
  };

  useEffect(() => {
    if ('blocks' in msg.content) {
      let chartCode = '';
      let reactComponentCode = '';

      for (const block of msg.content.blocks) {
        if (block.block_type === 'react') {
          reactComponentCode = block.code;
          const jsCodeRegex = /```javascript\n([\s\S]*?)\n```/;
          const match = reactComponentCode.match(jsCodeRegex);
          if (match) {
            chartCode = match[1];
            break;
          }
        }
      }

      if (chartCode && chartRef.current) {
        const canvas = chartRef.current;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          if (chartInstance.current) {
            chartInstance.current.destroy();
          }

          const originalGetElementById = document.getElementById;
          document.getElementById = (id: string) => {
            if (id === 'myChart') {
              return canvas;
            }
            return originalGetElementById(id);
          };

          try {
            new Function('Chart', chartCode)(Chart);
          } catch (error) {
            console.error("Error executing chart JavaScript:", error);
          } finally {
            document.getElementById = originalGetElementById;
          }
        }
      }
    }
  }, [msg.content]);

  const components: Components = {
    code({ inline, className, children }: CodeComponentProps) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          style={codeBlockStyle as any}
          language={match[1]}
          PreTag="div"
          customStyle={{ background: 'transparent' }}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className}>
          {children}
        </code>
      );
    },
  };

  return (
    <div className={`message-row ${msg.role}`}>
      <div className={`message-avatar ${msg.role}`}>
        {msg.role === 'ai' ? <Bot size={18} /> : <User size={18} />}
      </div>
      <div className="message-content-wrapper">
        <div className="message-sender">
          {msg.role === 'ai' ? 'Jarvis' : 'You'}
        </div>
        <div className={`message-bubble ${msg.role}`}>
          {'blocks' in msg.content ? (
            msg.content.blocks.map((block, index) => {
              if (block.block_type === 'text') {
                return (
                  <ReactMarkdown
                    key={index}
                    remarkPlugins={[remarkGfm]}
                    components={components}
                  >
                    {block.text}
                  </ReactMarkdown>
                );
              } else if (block.block_type === 'react') {
                const DynamicComponent = () => {
                  try {
                    const transpiledCode = Babel.transform(block.code, {
                      presets: ['react', 'env']
                    }).code;

                    if (!transpiledCode) return <p>Error rendering component.</p>;

                    const exports: { default?: React.ComponentType<any> } = {};
                    const func = new Function('React', 'exports', transpiledCode.replace(/export default/, 'exports.default ='));
                    func(React, exports);
                    const Component = exports.default;
                    return Component ? <div className="dynamic-react-component"><Component /></div> : null;
                  } catch (e) {
                    console.error("Error rendering React component:", e);
                    return <p>Error rendering component.</p>;
                  }
                };
                return <DynamicComponent key={index} />;
              }
              return null;
            })
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={components}
            >
              {'text' in msg.content ? msg.content.text : ''}
            </ReactMarkdown>
          )}
          {'blocks' in msg.content && msg.content.blocks.some(block => block.block_type === 'react' && block.code.includes('new Chart')) && (
            <canvas ref={chartRef} id="myChart" width="800" height="400"></canvas>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
