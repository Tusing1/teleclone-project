import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface LeaderboardEntry {
    user_id: string;
    username: string;
    avatar_url: string | null;
    score: number;
    rank: number;
}

export function useGameLeaderboard(gameId: string) {
    const { user } = useAuth();
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLeaderboard = useCallback(async () => {
        setLoading(true);
        try {
            // We'll look for token_transactions of activity_type 'game_score'
            // and parse the gameId from the description or use specific activity_type like 'game_score_{gameId}'
            const { data, error } = await supabase
                .from('token_transactions')
                .select(`
                    amount,
                    description,
                    user_id,
                    profiles:user_id (
                        username,
                        avatar_url
                    )
                `)
                .eq('activity_type', `game_score_${gameId}`)
                .order('amount', { ascending: false })
                .limit(20);

            if (error) throw error;

            if (data) {
                // Group by user and take their best score
                const userBestScores: { [key: string]: LeaderboardEntry } = {};

                data.forEach((tx: any) => {
                    if (!userBestScores[tx.user_id] || tx.amount > userBestScores[tx.user_id].score) {
                        userBestScores[tx.user_id] = {
                            user_id: tx.user_id,
                            username: tx.profiles?.username || 'Student',
                            avatar_url: tx.profiles?.avatar_url,
                            score: tx.amount,
                            rank: 0 // Will assign after sorting
                        };
                    }
                });

                const sorted = Object.values(userBestScores)
                    .sort((a, b) => b.score - a.score)
                    .map((entry, index) => ({ ...entry, rank: index + 1 }));

                setLeaderboard(sorted);
            }
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
        } finally {
            setLoading(false);
        }
    }, [gameId]);

    const saveScore = useCallback(async (score: number) => {
        if (!user) return;

        try {
            // Log as a transaction with 0 tokens (using earnTokens logic)
            // But here we insert directly into token_transactions with type 'info' or similar if possible
            // Since token_transactions is strictly earn/spend in the hook, let's just use it
            // with a special activity_type and description.

            const { error } = await supabase
                .from('token_transactions')
                .insert({
                    user_id: user.id,
                    amount: score,
                    transaction_type: 'earn', // Using earn type but it's for score
                    activity_type: `game_score_${gameId}`,
                    description: `High score in ${gameId}`
                });

            if (error) throw error;
            fetchLeaderboard();
        } catch (error) {
            console.error('Error saving score:', error);
        }
    }, [user, gameId, fetchLeaderboard]);

    useEffect(() => {
        fetchLeaderboard();
    }, [fetchLeaderboard]);

    return {
        leaderboard,
        loading,
        saveScore,
        refresh: fetchLeaderboard
    };
}
