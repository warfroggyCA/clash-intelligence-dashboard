import TownHallIcon from '@/components/new-ui/icons/TownHallIcon';
import LeagueIcon from '@/components/new-ui/icons/LeagueIcon';
import HeroIcon from '@/components/new-ui/icons/HeroIcon';
import RoleIcon from '@/components/new-ui/icons/RoleIcon';
import Card from '@/components/new-ui/Card';
import Image from 'next/image';
import { miscIcons } from '@/components/new-ui/icons/maps';

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
    </div>
  );
}
