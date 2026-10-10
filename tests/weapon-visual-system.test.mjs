import test from 'node:test';
import assert from 'node:assert/strict';
import { stableWeaponHash, weaponVisualDefinition } from '../src/weapon-visual-system.js';

test('weapon visual signatures are deterministic and distinct',()=>{
  const rifle={id:'specter',kind:'rifle',weaponClass:'BURST CARBINE',magSize:30};
  assert.deepEqual(weaponVisualDefinition(rifle),weaponVisualDefinition(rifle));
  assert.notEqual(weaponVisualDefinition(rifle).fingerprint,weaponVisualDefinition({...rifle,id:'stormcoil-carbine',special:'stormcoil'}).fingerprint);
  assert.equal(stableWeaponHash('specter'),stableWeaponHash('specter'));
});

test('weapon roles produce recognizable components',()=>{
  assert.equal(weaponVisualDefinition({id:'quiet',kind:'pistol',silent:true,weaponClass:'SILENCED SIDEARM',magSize:12}).muzzleStyle,'suppressor');
  assert.equal(weaponVisualDefinition({id:'wheelgun',kind:'pistol',weaponClass:'HEAVY REVOLVER',magSize:6}).magazineStyle,'cylinder');
  assert.equal(weaponVisualDefinition({id:'auto-shotgun',kind:'shotgun',weaponClass:'AUTO SHOTGUN',automatic:true,magSize:20}).magazineStyle,'drum');
  assert.equal(weaponVisualDefinition({id:'precision',kind:'sniper',weaponClass:'HEAVY SNIPER',scoped:true}).opticStyle,'scope');
});

test('special melee weapons receive their own silhouettes',()=>{
  const styles=[
    ['tuning-fork-blades','tuning-fork'],['railhook','hook'],['phase-katana','katana'],['reverb-hammer','hammer'],
    ['coil-baton','baton'],['glass-fang','glass-blade'],['momentum-gauntlets','gauntlet'],['piston-axe','axe'],['cable-whip','whip'],['signal-saber','saber'],
  ];
  for(const [id,expected] of styles)assert.equal(weaponVisualDefinition({id,kind:'knife'}).meleeStyle,expected,id);
});
