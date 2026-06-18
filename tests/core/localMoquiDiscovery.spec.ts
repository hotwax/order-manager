import { afterEach, describe, expect, it, vi } from 'vitest';
import { discoverLocalMoquiServers, getLocalMoquiProbePorts } from '@common/core/localMoquiDiscovery';

describe('local Moqui discovery', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('includes configured local ports before the default probes', () => {
    vi.stubEnv('VITE_LOCAL_MOQUI_PORTS', '9090, 8080, bad, 9091');

    expect(getLocalMoquiProbePorts()).toEqual([9090, 8080, 9091, 8443, 8081, 8082]);
  });

  it('returns selectable OMS options for localhost ports with Moqui API responses', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url === 'http://localhost:8080/rest/s1/admin/checkLoginOptions') {
        return new Response(JSON.stringify({ loginAuthType: 'BASIC' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }

      return new Response('Not found', { status: 404 });
    });

    const servers = await discoverLocalMoquiServers({
      ports: [8080, 9999],
      fetcher
    });

    expect(servers).toEqual([
      {
        label: 'Local Moqui 8080',
        oms: 'http://localhost:8080',
        port: 8080,
        signal: 'checkLoginOptions'
      }
    ]);
  });

  it('uses the dev server discovery endpoint before browser port probes', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url === '/__accxui/local-moqui-servers') {
        return new Response(JSON.stringify([
          {
            label: 'Local Moqui 18080',
            oms: 'http://localhost:18080',
            port: 18080,
            signal: 'checkLoginOptions'
          }
        ]), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }

      throw new Error(`Unexpected probe: ${url}`);
    });

    const servers = await discoverLocalMoquiServers({ fetcher });

    expect(servers).toEqual([
      {
        label: 'Local Moqui 18080',
        oms: 'http://localhost:18080',
        port: 18080,
        signal: 'checkLoginOptions'
      }
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not fall back to browser port probes when the dev endpoint returns no servers', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url === '/__accxui/local-moqui-servers') {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }

      throw new Error(`Unexpected probe: ${url}`);
    });

    await expect(discoverLocalMoquiServers({ fetcher })).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('treats any reachable Moqui REST response as a local server signal', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url === 'http://localhost:8081/rest/s1/') {
        return new Response('', { status: 401 });
      }

      return Promise.reject(new TypeError('fetch failed'));
    });

    const servers = await discoverLocalMoquiServers({
      ports: [8081],
      fetcher
    });

    expect(servers[0]).toMatchObject({
      label: 'Local Moqui 8081',
      oms: 'http://localhost:8081',
      port: 8081,
      signal: 'rest'
    });
  });
});
