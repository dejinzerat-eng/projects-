import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseVideoUrl } from '@dej/shared';

describe('parseVideoUrl', () => {
  const id = 'dQw4w9WgXcQ';
  it('rozpozná všechny běžné tvary odkazů na YouTube', () => {
    for (const u of [
      `https://www.youtube.com/watch?v=${id}`, `https://youtube.com/watch?v=${id}&t=42s`, `https://m.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}`, `https://youtu.be/${id}?si=abc`, `https://www.youtube.com/shorts/${id}`, `https://youtube.com/embed/${id}`,
      `https://www.youtube.com/live/${id}?feature=share`, `https://www.youtube-nocookie.com/embed/${id}`, `youtube.com/watch?v=${id}`, `http://youtu.be/${id}`,
    ]) {
      const v = parseVideoUrl(u);
      assert.ok(v, u);
      assert.equal(v.provider, 'youtube');
      assert.equal(v.id, id);
      assert.equal(v.url, `https://www.youtube.com/watch?v=${id}`);
      assert.equal(v.embed, `https://www.youtube-nocookie.com/embed/${id}`);
    }
  });

  it('rozpozná odkazy na Vimeo', () => {
    assert.equal(parseVideoUrl('https://vimeo.com/76979871')?.embed, 'https://player.vimeo.com/video/76979871');
    assert.equal(parseVideoUrl('https://vimeo.com/channels/staffpicks/76979871')?.id, '76979871');
    assert.equal(parseVideoUrl('https://player.vimeo.com/video/76979871?h=abc123')?.embed, 'https://player.vimeo.com/video/76979871?h=abc123');
    assert.equal(parseVideoUrl('https://vimeo.com/76979871/da1b2c3d4e')?.embed, 'https://player.vimeo.com/video/76979871?h=da1b2c3d4e');
    assert.equal(parseVideoUrl('https://vimeo.com/showcase/123/video/76979871')?.id, '76979871');
    assert.equal(parseVideoUrl('https://vimeo.com/groups/abc/videos/76979871')?.id, '76979871');
  });

  it('odmítne ostatní odkazy', () => {
    for (const u of ['', 'https://example.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=kratke', 'https://www.youtube.com/@kanal', 'https://www.youtube.com/playlist?list=PL123',
      'https://vimeo.com/showcase/123', 'https://vimeo.com/user123', 'javascript:alert(1)', 'https://youtube.com.evil.cz/watch?v=dQw4w9WgXcQ', 'ftp://youtu.be/dQw4w9WgXcQ', 'nesmysl']) {
      assert.equal(parseVideoUrl(u), null, u);
    }
  });
});
