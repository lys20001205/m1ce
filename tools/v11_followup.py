"""Bounded V11-L fixture repair; removed by CI only after every gate passes."""
from pathlib import Path

p=Path('tests/browser_v11_release.py')
s=p.read_text()
a=s.index('        # Five actual melee inputs')
b=s.index("        report['checks']['e2e_armory_upgrade']",a)
s=s[:a]+'''        # Controlled encounter, real boarding / full-HP combat / rewards. No hit or reward shortcuts.
        # Director rest isolates this encounter without pausing the world or replacing game methods.
        await page.evaluate('(()=>{const g=__RH_TEST.game();g.enemies=[];g.director.rest=120;g.director.clock=0;})()')
        report['combatKills']=[]
        for i in range(5):
            fixture=await page.evaluate('(()=>{const a=__RH_TEST,g=a.game();g.pause(false);a.forcePlayer(3);g.player.face=1;const e=g.spawn("boarder",3.8,false);if(!e)throw Error("release fixture admission failed");const result={id:e.id,hp:e.hp,boarding:e.climb,before:g.scrap,kills:g.totalKills};a.step(e.climb+.05);return result;})()')
            await page.keyboard.down('KeyJ');await wait_state(page,'__RH_TEST.input().attack===true')
            result=await page.evaluate('(fixture)=>{const a=__RH_TEST,g=a.game();a.step(2,a.input());return {dead:!g.enemies.some(e=>e.id===fixture.id&&e.hp>0),scrap:g.scrap,kills:g.totalKills};}',fixture)
            await page.keyboard.up('KeyJ');await wait_state(page,'__RH_TEST.input().attack===false')
            result['fixture']=fixture;report['combatKills'].append(result)
            if not (result['dead'] and result['kills']==fixture['kills']+1 and result['scrap']==fixture['before']+2):
                raise AssertionError('Boarded enemy must produce one kill and two Scrap: '+json.dumps(result))
            # Finish the previous swing/cooldown naturally, without resetting combat state.
            await page.evaluate('__RH_TEST.step(.6)')
        scrap=await page.evaluate('__RH_DEBUG.snapshot().scrap');report['checks']['e2e_scrap_from_kills']=scrap>=10
        await page.evaluate('__RH_TEST.forcePlayer(1.7)');await tap(page,'#interact','__RH_TEST.game().armoryOpen===true');await page.locator('[data-armory=melee]').tap();await wait_state(page,'__RH_DEBUG.snapshot().meleeWeapon==="knife"')
'''+s[b:]
p.write_text(s)

p=Path('tests/combat.test.mjs')
p.write_text(p.read_text()+'''

test('boarding window rejects premature hits; natural full-health kills fund the first Armory purchase',()=>{
  const {g,events}=run();g.t=.29;g.speedMode='SLOW';g.director.rest=120;g.player.x=3;g.player.face=1;
  const early=g.spawn('boarder',3.8,false);assert(early);assert.equal(early.hp,V11.enemies.boarder.hp);
  tick(g,.22,{attack:true});assert(early.climb>0);assert.equal(early.hp,V11.enemies.boarder.hp);assert.equal(g.scrap,0);
  tick(g,.6);assert.equal(early.climb,0);tick(g,2,{attack:true});assert.equal(early.hp,0);assert.equal(g.scrap,2);tick(g,.6);
  for(let i=1;i<5;i++){
    g.player.x=3;g.player.face=1;const e=g.spawn('boarder',3.8,false);assert(e);assert.equal(e.hp,V11.enemies.boarder.hp);
    tick(g,e.climb+.05);assert.equal(e.climb,0);tick(g,2,{attack:true});assert.equal(e.hp,0);tick(g,.6);
  }
  assert.equal(g.totalKills,5);assert.equal(g.scrap,10);assert.equal(events.filter(e=>e.type==='scrap_gain').length,5);
  g.player.x=V11.armoryX;assert(g.openArmory());assert(g.buyWeapon('melee'));assert.equal(g.melee.id,'knife');assert.equal(g.scrap,0);
});
''')
print('V11-L real boarding and kill-reward regressions applied')
