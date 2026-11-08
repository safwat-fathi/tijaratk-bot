import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import { type DbOrTx, schema } from '../db/index.js';
import type { Message } from '../db/types.js';
import * as gateway from '../engine/gateway.js';
import { agglomerativeCosine } from './agglomerative.js';

const FALLBACK_LABEL_PREFIX = 'unknown_intent';

type EmbeddedMessage = Message & { merchantId: string };

/**
 * Opted-in merchants only. clustered_at IS NULL: a message already folded into a cluster (or deliberately left
 * out for being too small) is not re-fetched, otherwise every run would re-insert the same LabeledExample rows.
 * Deterministic ORDER BY so the sampled `limit` is stable.
 */
export async function fetchEmbeddedMessages(db: DbOrTx, limit: number): Promise<EmbeddedMessage[]> {
  const m = schema.messages;
  const rows = await db
    .select({ message: m, merchantId: schema.conversations.merchantId })
    .from(m)
    .innerJoin(schema.conversations, eq(schema.conversations.id, m.conversationId))
    .innerJoin(schema.merchants, eq(schema.merchants.id, schema.conversations.merchantId))
    .where(and(isNotNull(m.embedding), isNull(m.clusteredAt), eq(schema.merchants.autoLearningEnabled, true)))
    .orderBy(asc(m.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r.message, merchantId: r.merchantId }));
}

export function clusterMessages<T extends { embedding: number[] | null }>(messages: T[], distanceThreshold: number): Map<number, T[]> {
  const clusters = new Map<number, T[]>();
  if (messages.length < 2) return clusters;
  const labels = agglomerativeCosine(messages.map((m) => m.embedding!), distanceThreshold);
  labels.forEach((label, i) => clusters.set(label, [...(clusters.get(label) ?? []), messages[i]]));
  return clusters;
}

export function representativeMessages<T extends { embedding: number[] | null }>(cluster: T[], topN = 5): T[] {
  const vectors = cluster.map((m) => m.embedding!);
  const dim = vectors[0].length;
  const centroid = new Array<number>(dim).fill(0);
  for (const v of vectors) for (let k = 0; k < dim; k++) centroid[k] += v[k] / vectors.length;
  const cNorm = Math.sqrt(centroid.reduce((a, x) => a + x * x, 0));
  const sims = vectors.map((v) => {
    let dot = 0;
    let vn = 0;
    for (let k = 0; k < dim; k++) { dot += v[k] * centroid[k]; vn += v[k] * v[k]; }
    return dot / (Math.sqrt(vn) * cNorm + 1e-9);
  });
  return sims
    .map((s, i) => [s, i] as const)
    .sort((a, b) => b[0] - a[0] || a[1] - b[1])
    .slice(0, topN)
    .map(([, i]) => cluster[i]);
}

export async function labelCluster(representatives: { normalizedText: string | null }[], clusterSize: number, clusterId: number): Promise<string> {
  const texts = representatives.map((m) => `- ${m.normalizedText}`).join('\n');
  const systemPrompt =
    'You classify user messages into a 1-3 word intent. You also provide a very brief summary of the user messages. Respond with json: {"intent": snake_case_label, "summary": one_sentence}.';
  const userPrompt = `Cluster size: ${clusterSize}\nMessages:\n${texts}`;
  try {
    const data = await gateway.completeJson(gateway.deepseekProvider(), { systemPrompt, userPrompt });
    if (typeof data?.intent !== 'string') throw new Error('missing intent');
    return data.intent;
  } catch {
    return `${FALLBACK_LABEL_PREFIX}_${clusterId}`;
  }
}

export async function runClustering(db: DbOrTx, distanceThreshold = 0.3, minClusterSize = 3, limit = 1000): Promise<number> {
  const messages = await fetchEmbeddedMessages(db, limit);
  const byMerchant = new Map<string, EmbeddedMessage[]>();
  for (const m of messages) byMerchant.set(m.merchantId, [...(byMerchant.get(m.merchantId) ?? []), m]);

  let created = 0;
  for (const [merchantId, merchantMessages] of byMerchant) {
    // Each merchant is clustered in isolation: cross-merchant clusters would leak few-shot examples between tenants.
    for (const [clusterId, members] of clusterMessages(merchantMessages, distanceThreshold)) {
      if (members.length < minClusterSize) continue;
      const reps = representativeMessages(members);
      const intent = await labelCluster(reps, members.length, clusterId);
      for (const m of reps) {
        await db.insert(schema.labeledExamples).values({
          merchantId,
          normalizedText: m.normalizedText ?? '',
          intent,
          embedding: m.embedding,
          source: 'cluster_labeling',
        });
        created++;
      }
      const clusteredAt = new Date();
      for (const m of members) await db.update(schema.messages).set({ clusteredAt }).where(eq(schema.messages.id, m.id));
    }
  }
  return created;
}
