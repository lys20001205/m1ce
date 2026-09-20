"""Public-URL regression: confirm console paint and the requested speed.

This changes only the Python pilot, never game state or production source.
A failed interaction is recorded and fails the run; it is not called a softlock.
The older failed replay and its original driver remain available as evidence.
"""
import asyncio
import os
from playwright.async_api import TimeoutError as PlaywrightTimeoutError
import qa_extended  # Installs the existing two-lap public pilot.
import qa_exploratory as q


async def confirmed_speed(self, mode):
    """Use real controls and wait for visible UI, then check the postcondition."""
    await self.held()
    await self.walk(5.8)
    state = await self.state()
    if state['roof']:
        await self.tap('KeyW')
    panel = self.p.locator('#speedPanel')
    if await panel.is_hidden():
        await self.tap('KeyF')
    try:
        # An 80ms key delay is shorter than a software-rendered frame.
        # Wait for the actual panel instead of treating a stale DOM read as done.
        await panel.wait_for(state='visible', timeout=2000)
        await self.p.locator(f'[data-speed={mode}]').click(timeout=2000)
        await self.p.wait_for_function(
            '(mode) => __RH_DEBUG.snapshot().speedMode === mode',
            arg=mode, timeout=2000)
    except PlaywrightTimeoutError as error:
        self.log.append({'label': 'speed-ui-not-confirmed', 'mode': mode,
                         'exception': str(error),
                         'classification': 'QA_DRIVER_INTERACTION_NOT_CONFIRMED'})
        await self.record('speed-not-confirmed-' + mode)
        return False
    await self.record('speed-confirmed-' + mode, False)
    return True


original_cargo_stop = q.cargo_stop


async def checked_cargo_stop(session):
    await original_cargo_stop(session)
    state = await session.state()
    ok = state['speedMode'] == 'CRUISE' and state['playerLayer'] == 'INTERIOR'
    await session.check('depot_departure_lap_' + str(state['round']), ok)
    if not ok:
        raise RuntimeError('QA_DRIVER_DEPARTURE_NOT_CONFIRMED: inspect action log')


original_normal = q.normal


async def version_guarded_normal(session):
    expected = os.environ.get('QA_EXPECTED_PUBLIC_COMMIT')
    if not expected:
        raise RuntimeError('QA_EXPECTED_PUBLIC_COMMIT is required')
    response = await session.p.context.request.get(q.PUBLIC + 'build.json')
    build = await response.json()
    await session.check('expected_public_commit', build.get('commit') == expected)
    if build.get('commit') != expected:
        raise RuntimeError('Public version changed; do not attribute this run to expected commit')
    await original_normal(session)


q.Session.speed = confirmed_speed
q.cargo_stop = checked_cargo_stop
q.normal = version_guarded_normal

if __name__ == '__main__':
    asyncio.run(q.main())
