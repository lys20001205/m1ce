"""V11-K regression fix: faster repair must never shorten the established Last Chance grace window."""
from pathlib import Path
p=Path('src/sim.js')
s=p.read_text()
old="const restartTime=this.emergencyRepairTime,window=Math.max(B.rescueMinimum,Math.ceil(travel+restartTime+B.rescueMargin));"
new="const restartTime=this.emergencyRepairTime,window=Math.max(B.rescueMinimum,Math.ceil(travel+B.restartTime+B.rescueMargin));"
if old not in s: raise SystemExit('expected K rescue-window line missing')
p.write_text(s.replace(old,new,1))
print('V11-K rescue deadline remains conservative; kit changes channel duration only.')
