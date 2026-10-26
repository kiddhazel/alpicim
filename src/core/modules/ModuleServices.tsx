import { lazy, Suspense, type ComponentType } from 'react';
import { servicesOf } from './registry';
import type { ServiceHostSlot, ServiceProps } from './types';
import { useModules } from './useModules';

const LAZY = new Map<string, ComponentType<ServiceProps>>();

function component(moduleId: string, serviceId: string, load: () => Promise<{ default: ComponentType<ServiceProps> }>) {
  const key = `${moduleId}:${serviceId}`;
  let c = LAZY.get(key);
  if (!c) {
    c = lazy(load);
    LAZY.set(key, c);
  }
  return c;
}

/**
 * Etkin modüllerin arka plan servislerini verilen yuvaya bağlar. Kapalı modülün servisi hiç yüklenmez/bağlanmaz
 * (dolayısıyla dinleyici, zamanlayıcı ve ağ isteği de oluşmaz).
 */
export function ModuleServices({ host, ...props }: ServiceProps & { host: ServiceHostSlot }) {
  const { active } = useModules();
  const list = servicesOf(active, host);
  if (list.length === 0) return null;
  return (
    <Suspense fallback={null}>
      {list.map(({ module, service }) => {
        const C = component(module.id, service.id, service.load);
        return <C key={`${module.id}:${service.id}`} {...props} />;
      })}
    </Suspense>
  );
}
