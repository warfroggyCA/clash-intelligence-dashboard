import TownHallIcon from '@/components/new-ui/icons/TownHallIcon';
import LeagueIcon from '@/components/new-ui/icons/LeagueIcon';
import HeroIcon from '@/components/new-ui/icons/HeroIcon';
import RoleIcon from '@/components/new-ui/icons/RoleIcon';
import Card from '@/components/new-ui/Card';
import Image from 'next/image';
import { miscIcons } from '@/components/new-ui/icons/maps';
import { heroEquipmentData } from '@/lib/hero-equipment';

const thLevels = [12, 14, 15, 16, 17, 18];
const rankedLeagues = [
  'Barbarian League',
  'Archer League',
  'Wizard League',
  'Witch League',
  'Valkyrie League',
  'Golem League',
  'PEKKA League',
  'Dragon League',
  'Electro League',
  'Skeleton League',
  'Titan League',
  'Legend League',
];

const roles: { role: 'leader' | 'coleader' | 'elder' | 'member'; label: string }[] = [
  { role: 'leader', label: 'Leader' },
  { role: 'coleader', label: 'Co-Leader' },
  { role: 'elder', label: 'Elder' },
  { role: 'member', label: 'Member' },
];

const cleanEquipmentName = (value: string) =>
  value
    ?.replace(/\blevel\s*\d+/i, '')
    ?.replace(/\blv\.?\s*\d+/i, '')
    ?.replace(/\d+$/i, '')
    ?.replace(/\s{2,}/g, ' ')
    ?.trim();

const normalizeEquip = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const equipmentIconMap: Record<string, string> = {
  // Archer Queen
  archerpuppet: '/assets/equipment/Hero_Equipment_AQ_Archer_Puppet.png',
  frozenarrow: '/assets/equipment/Hero_Equipment_AQ_Frozen_Arrow.png',
  giantarrow: '/assets/equipment/Hero_Equipment_AQ_Giant_Arrow.png',
  healerpuppet: '/assets/equipment/Hero_Equipment_AQ_Healer_Puppet.png',
  invisibilityvial: '/assets/equipment/Hero_Equipment_AQ_Invisibility_Vial.png',
  magicmirror: '/assets/equipment/Hero_Equipment_AQ_Magic_Mirror.png',
  actionfigure: '/assets/equipment/Hero_Equipment_AQ_WWEActionFigure.png',
  wweactionfigure: '/assets/equipment/Hero_Equipment_AQ_WWEActionFigure.png',
  // Barbarian King
  barbarianpuppet: '/assets/equipment/Hero_Equipment_BK_Barbarian_Puppet.png',
  earthquakeboots: '/assets/equipment/Hero_Equipment_BK_Earthquake_Boots.png',
  ragevial: '/assets/equipment/Hero_Equipment_BK_Rage_Vial.png',
  snakebracelet: '/assets/equipment/Hero_Equipment_BK_SnakeBracelet.png',
  vampstache: '/assets/equipment/Hero_Equipment_BK_Vampstache.png',
  giantgauntlet: '/assets/equipment/Hero_Equipment_BQ_Giant_Gauntlet.png',
  spikyball: '/assets/equipment/Hero_Equipment_BK_Spiky_Ball.png',
  spikyball: '/assets/equipment/Hero_Equipment_BQ_Giant_Gauntlet.png',
  // Grand Warden
  eternaltome: '/assets/equipment/Hero_Equipment_GW_Eternal_Tome.png',
  fireball: '/assets/equipment/Hero_Equipment_GW_Fireball.png',
  healingtome: '/assets/equipment/Hero_Equipment_GW_Healing_Tome.png',
  lifegem: '/assets/equipment/Hero_Equipment_GW_Life_Gem.png',
  ragegem: '/assets/equipment/Hero_Equipment_GW_Rage_Gem.png',
  lavaloonpuppet: '/assets/equipment/icon_gear_GW_LavaloonPuppet.png',
  heroictorch: '/assets/equipment/HeroGear_GW_Olympic_Torch_hh0000.png',
  torch: '/assets/equipment/HeroGear_GW_Olympic_Torch_hh0000.png',
  // Royal Champion
  electroboots: '/assets/equipment/Hero_Equipment_RC_ElectroBoots.png',
  hastevial: '/assets/equipment/Hero_Equipment_RC_Haste_Vial.png',
  hogriderdoll: '/assets/equipment/Hero_Equipment_RC_Hog_Rider_Doll.png',
  hogriderpuppet: '/assets/equipment/Hero_Equipment_RC_Hog_Rider_Doll.png',
  royalgem: '/assets/equipment/Hero_Equipment_RC_Royal_Gem.png',
  seekingshield: '/assets/equipment/Hero_Equipment_RC_Seeking_Shield.png',
  rocketspear: '/assets/equipment/HeroGear_RoyalChampion_RocketSpear_Equipment_03.png',
  // Minion Prince
  darkcrown: '/assets/equipment/HeroGear_MP_DarkCrown_2k.png',
  darkorb: '/assets/equipment/Hero_Equipment_MP_DarkOrb.png',
  henchman: '/assets/equipment/Hero_Equipment_MP_Henchman.png',
  henchmen: '/assets/equipment/Hero_Equipment_MP_Henchman.png',
  henchmanpuppet: '/assets/equipment/Hero_Equipment_MP_Henchman.png',
  henchmenpuppet: '/assets/equipment/Hero_Equipment_MP_Henchman.png',
  powerpump: '/assets/equipment/Hero_Equipment_MP_PowerPump.png',
  nobleiron: '/assets/equipment/Hero_Equipment_MP_PowerPump.png',
  ironpants: '/assets/equipment/HeroEquipment_MP_IronPants.png',
  metalpants: '/assets/equipment/HeroEquipment_MP_IronPants.png',
  meteorstaff: '/assets/equipment/HeroGear_MP_MeteoriteSceptre.png',
  meteoritesceptre: '/assets/equipment/HeroGear_MP_MeteoriteSceptre.png',
  meteorsceptre: '/assets/equipment/HeroGear_MP_MeteoriteSceptre.png',
};

const getEquipmentIcon = (name: string): string | undefined => {
  const clean = cleanEquipmentName(name) || name;
  const key = normalizeEquip(clean);
  if (equipmentIconMap[key]) return equipmentIconMap[key];
  if (key.includes('henchman') || key.includes('henchmen')) return equipmentIconMap.henchman;
  if (key.includes('hogrider')) return equipmentIconMap.hogriderdoll;
  if (key.includes('ironpant') || key.includes('metalpant')) return equipmentIconMap.ironpants;
  if (key.includes('darkcrown')) return equipmentIconMap.darkcrown;
  if (key.includes('darkorb')) return equipmentIconMap.darkorb;
  if (key.includes('meteor')) return equipmentIconMap.meteorstaff;
  if (key.includes('torch')) return equipmentIconMap.heroictorch;
  if (key.includes('nobleiron')) return equipmentIconMap.nobleiron;
  if (key.includes('powerpump')) return equipmentIconMap.powerpump;
  return undefined;
};

export default function IconographyPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Iconography</h1>
        <p className="text-slate-300 text-sm">Town Hall, League, Hero, Role, and status badges using the new surfaces.</p>
      </div>

      <Card title="Town Hall Levels">
        <div className="flex flex-wrap gap-3 items-end">
          {thLevels.map((level) => (
            <div key={level} className="flex flex-col items-center gap-1 text-xs text-slate-300">
              <TownHallIcon level={level} size="md" />
              <span>TH {level}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Ranked Leagues">
          <div className="flex flex-wrap gap-3 items-end">
            {rankedLeagues.map((name) => (
              <div key={name} className="flex flex-col items-center gap-1 text-xs text-slate-300">
                <LeagueIcon league={name} ranked size="sm" />
                <span>{name}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Roles">
        <div className="flex flex-wrap gap-4 items-end text-xs text-slate-300">
          {roles.map(({ role, label }) => (
            <div key={role} className="flex flex-col items-center gap-1">
              <RoleIcon role={role} size={56} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Status & Misc">
        <div className="flex flex-wrap items-end gap-4 text-xs text-slate-300">
          <div className="flex flex-col items-center gap-1">
            <Image src={miscIcons.warShield} alt="War Shield" width={64} height={64} className="object-contain" />
            <span>War Shield</span>
          </div>
        </div>
      </Card>

      <Card title="Heroes">
        <div className="flex flex-wrap gap-3 items-end text-xs text-slate-300">
          <div className="flex flex-col items-center gap-1">
            <HeroIcon hero="bk" label="Barbarian King" size="lg" />
            <span>Barbarian King</span>
          </div>
              <div className="flex flex-col items-center gap-1">
                <HeroIcon hero="aq" label="Archer Queen" size="lg" />
                <span>Archer Queen</span>
              </div>
          <div className="flex flex-col items-center gap-1">
            <HeroIcon hero="gw" label="Grand Warden" size="lg" />
            <span>Grand Warden</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <HeroIcon hero="rc" label="Royal Champion" size="lg" />
            <span>Royal Champion</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <HeroIcon hero="mp" label="Minion Prince" size="lg" />
            <span>Minion Prince</span>
          </div>
        </div>
      </Card>

      <Card title="Hero Equipment">
        <div className="space-y-4">
          {heroEquipmentData.map((hero) => (
            <div key={hero.hero} className="space-y-2">
              <h3 className="text-sm font-semibold text-white">{hero.hero}</h3>
              <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                {hero.equipment.map((eq) => {
                  const icon = getEquipmentIcon(eq.name);
                  const subtitle = `${eq.rarity} · Max ${eq.maxLevel}`;
                  const isEpic = eq.rarity === 'Epic';
                  const epicGradient = 'linear-gradient(180deg, #a74ce5 0%, #933fcb 50%, #b04fac 100%)';
                  return (
                    <div
                      key={eq.name}
                      className="flex flex-col items-center gap-1 rounded-xl border px-3 py-2"
                      style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}
                      title={`${eq.name} • ${eq.description}`}
                    >
                      <div
                        className="h-16 w-16 rounded-lg flex items-center justify-center overflow-hidden"
                        style={{ background: isEpic ? epicGradient : 'var(--panel)' }}
                      >
                        {icon ? (
                          <Image
                            src={icon}
                            alt={eq.name}
                            width={64}
                            height={64}
                            className="object-contain"
                            style={{ width: '64px', height: '64px' }}
                          />
                        ) : (
                          <div className="h-full w-full bg-white/5 flex items-center justify-center text-center px-1 text-[11px] text-slate-100">
                            {eq.name}
                          </div>
                        )}
                      </div>
                      <span className="text-white font-semibold text-center leading-tight">{eq.name}</span>
                      <span className="text-[11px] text-slate-400">{subtitle}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
