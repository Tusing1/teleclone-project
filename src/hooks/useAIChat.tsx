import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useStudyTokens, TOKEN_COSTS } from '@/hooks/useStudyTokens';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIUsage {
  question_count: number;
  last_reset: string;
}

const FREE_QUESTIONS_PER_DAY = 5;
const TOKENS_PER_QUESTION = 5;

export function useAIChat() {
  const { user } = useAuth();
  const { balance, spendTokens, isFeatureUnlocked } = useStudyTokens();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [usage, setUsage] = useState<AIUsage | null>(null);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [isExtended, setIsExtended] = useState(false);

  const fetchUsage = useCallback(async () => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('ai_usage')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching AI usage:', error);
      return;
    }

    if (data) {
      // Check if we need to reset for new day
      if (data.last_reset !== today) {
        const { data: updated, error: updateError } = await supabase
          .from('ai_usage')
          .update({ question_count: 0, last_reset: today, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .select()
          .single();

        if (!updateError && updated) {
          setUsage({ question_count: 0, last_reset: today });
        }
      } else {
        setUsage({ question_count: data.question_count, last_reset: data.last_reset });
      }
    } else {
      // Create usage record
      const { data: created, error: createError } = await supabase
        .from('ai_usage')
        .insert({ user_id: user.id, question_count: 0, last_reset: today })
        .select()
        .single();

      if (!createError && created) {
        setUsage({ question_count: 0, last_reset: today });
      }
    }
  }, [user]);

  useEffect(() => {
    const checkPremium = async () => {
      if (!user) return;
      const unlimited = await isFeatureUnlocked('UNLIMITED_AI');
      const extended = await isFeatureUnlocked('EXTENDED_AI');
      setIsUnlimited(unlimited);
      setIsExtended(extended);
    };
    checkPremium();
  }, [user, isFeatureUnlocked]);

  const dailyLimit = isExtended ? 50 : FREE_QUESTIONS_PER_DAY;

  const getFreeQuestionsRemaining = useCallback(() => {
    if (isUnlimited) return 999;
    if (!usage) return dailyLimit;
    return Math.max(0, dailyLimit - usage.question_count);
  }, [usage, isUnlimited, dailyLimit]);

  const canAskQuestion = useCallback(() => {
    const freeRemaining = getFreeQuestionsRemaining();
    if (freeRemaining > 0) return true;
    return balance >= TOKENS_PER_QUESTION;
  }, [getFreeQuestionsRemaining, balance]);

  const incrementUsage = async () => {
    if (!user || !usage) return;

    const { error } = await supabase
      .from('ai_usage')
      .update({
        question_count: usage.question_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (!error) {
      setUsage({ ...usage, question_count: usage.question_count + 1 });
    }
  };

  const sendMessage = async (content: string) => {
    if (!user || !content.trim()) return;

    const freeRemaining = getFreeQuestionsRemaining();
    const needsTokens = freeRemaining <= 0;

    if (needsTokens && balance < TOKENS_PER_QUESTION) {
      toast.error(`Need ${TOKENS_PER_QUESTION} tokens to ask more questions today`);
      return;
    }

    // Spend tokens if no free questions left
    if (needsTokens) {
      const success = await spendTokens(TOKENS_PER_QUESTION, 'ai_question', 'AI Chat question');
      if (!success) {
        toast.error('Failed to use tokens');
        return;
      }
    }

    const userMsg: Message = { role: 'user', content };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    let assistantContent = '';

    const upsertAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        return [...prev, { role: 'assistant', content: assistantContent }];
      });
    };

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get response');
      }

      if (!resp.body) {
        throw new Error('No response body');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const chunkContent = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (chunkContent) upsertAssistant(chunkContent);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final buffer flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const chunkContent = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (chunkContent) upsertAssistant(chunkContent);
          } catch { }
        }
      }

      // Increment usage after successful response
      await incrementUsage();
    } catch (error) {
      console.error('AI chat error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get AI response');
      // Remove the empty assistant message if there was an error
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return {
    messages,
    isLoading,
    usage,
    freeQuestionsRemaining: getFreeQuestionsRemaining(),
    tokensPerQuestion: TOKENS_PER_QUESTION,
    canAskQuestion: canAskQuestion(),
    sendMessage,
    generateIcebreakers: async (otherProfile: any) => {
      if (!user) return [];

      const prompt = `Generate 3 short, playful, and friendly conversation starters for a study buddy named ${otherProfile.full_name || otherProfile.username} who is interested in ${otherProfile.interests?.join(', ') || 'studying'}. Keep them engaging and relevant to students. Format as a JSON array of strings. ONLY RETURN THE JSON ARRAY.`;

      try {
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            stream: true // The edge function currently forces stream: true effectively
          }),
        });

        if (!resp.ok) throw new Error('Failed to fetch icebreakers');
        if (!resp.body) throw new Error('No response body');

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let streamDone = false;

        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          
          // Parse SSE format: data: {...}
          const lines = chunk.split('\n');
          for (let line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') {
                streamDone = true;
                break;
              }
              try {
                const parsed = JSON.parse(jsonStr);
                const chunkContent = parsed.choices?.[0]?.delta?.content;
                if (chunkContent) fullContent += chunkContent;
              } catch (e) {
                // Ignore parse errors for partial chunks
              }
            }
          }
        }

        try {
          // Find JSON array in content
          const match = fullContent.match(/\[.*\]/s);
          if (match) return JSON.parse(match[0]);
        } catch (e) {
          console.error("Failed to parse icebreakers from content:", fullContent, e);
        }

        // High quality fallbacks if parsing fails but request succeeded
        return [
          `Hey ${otherProfile.full_name || otherProfile.username}! Saw you're into ${otherProfile.interests?.[0] || 'studying'}. Ready to crush some goals together?`,
          `Hi! I'm looking for a study partner for ${otherProfile.interests?.[0] || 'our subjects'}. You interested?`,
          `Your profile is awesome! Any chance you'd want to join a study session later?`
        ];
      } catch (e) {
        console.error("Icebreaker error:", e);
        return [
          `Hey ${otherProfile.full_name || otherProfile.username}! Ready to crush some study sessions?`,
          `Hi! I'm looking for a study buddy and you seemed like a great match. Want to sync up?`,
          `Study session soon? I need some motivation!`
        ];
      }
    },
    clearMessages,
    fetchUsage,
  };
}
