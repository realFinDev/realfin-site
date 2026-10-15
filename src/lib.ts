import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

export async function getPosts() {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export async function getAuthors() {
  return getCollection('authors');
}

export async function authorOf(post: CollectionEntry<'blog'>) {
  const author = await getEntry(post.data.author);
  if (!author) throw new Error(`Unknown author "${post.data.author.id}" in post ${post.id}`);
  return author;
}

export function avatarOf(author: CollectionEntry<'authors'>) {
  return author.data.avatar ?? '/images/authors/default.svg';
}

export function formatDate(d: Date) {
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function readingTime(body: string | undefined) {
  const words = (body ?? '').trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}
