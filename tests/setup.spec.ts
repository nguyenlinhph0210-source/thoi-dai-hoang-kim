import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SetupState } from '../src/types/game';

for (const branch of ['Văn giai','Võ giai','Nội cung','Hậu cung']) {
  test(`${branch}: choose branch and generate a real server preview`,async({page})=>{
    await page.goto('/');
    await page.getByRole('button',{name:new RegExp(`^${branch}`)}).click();
    await page.getByRole('button',{name:'Khai mở thân phận'}).click();
    await expect(page.getByRole('button',{name:'Chấp nhận thân phận'})).toBeVisible();
    await expect(page.getByTestId('stat-int')).not.toHaveText('—');
    await expect(page.getByTestId('free-rerolls')).toHaveText('3 / 3');
    await expect(page.getByRole('button',{name:new RegExp(`^${branch}`)})).toBeDisabled();
    await page.reload();
    await expect(page.getByRole('button',{name:'Chấp nhận thân phận'})).toBeVisible();
    await expect(page.getByTestId('free-rerolls')).toHaveText('3 / 3');
  });
}
test('three free rerolls, paid rerolls, reward transfer, hidden stat and confirmation survive reload',async({page,context})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByRole('button',{name:'Khai mở thân phận'}).click();
  await expect(page.getByRole('button',{name:'Chấp nhận thân phận'})).toBeVisible();
  const cookie=(await context.cookies()).find(c=>c.name==='dai-noi-ky-session');expect(cookie?.httpOnly).toBe(true);
  const file=join(process.env.GAME_E2E_DATA_DIR!,`${cookie!.value}.json`);
  const state=JSON.parse(await readFile(file,'utf8')) as SetupState;
  // Test-only fixture: simulate previously earned account resources on the server.
  state.account.destinyPoints=2;state.account.pendingRewardSilver=200;
  await writeFile(file,JSON.stringify(state));await page.reload();
  for(let remaining=2;remaining>=0;remaining--) {
    await page.getByRole('button',{name:/Đổi thân phận/}).click();
    await expect(page.getByTestId('free-rerolls')).toHaveText(`${remaining} / 3`);
  }
  for(let points=1;points>=0;points--) {
    await page.getByRole('button',{name:/Đổi thân phận/}).click();
    await expect(page.getByTestId('destiny-points')).toHaveText(String(points));
  }
  await expect(page.getByRole('button',{name:/Đổi thân phận/})).toBeDisabled();
  const before=JSON.parse(await readFile(file,'utf8')) as SetupState;
  await page.reload();await expect(page.getByTestId('free-rerolls')).toHaveText('0 / 3');
  const html=await page.content();expect(html).not.toContain('"suspicion":');expect(html).not.toContain('"suspicionFloor":');
  await page.getByRole('button',{name:'Chấp nhận thân phận'}).click();
  await page.getByRole('button',{name:'Xác nhận nhập kinh'}).click();
  await expect(page.getByRole('heading',{name:'Một cuộc đời đã mở'})).toBeVisible();
  await expect(page.getByText('Đã ghi danh vào kinh thành',{exact:true})).toBeVisible();
  const after=JSON.parse(await readFile(file,'utf8')) as SetupState;
  expect(after.character!.characterSilver).toBe(before.character!.characterSilver+200);
  expect(after.account.pendingRewardSilver).toBe(0);expect(after.account.hasCreatedCharacter).toBe(true);
  expect(after.character!.promotionRequirements!.conditions).toHaveLength(3);
  await page.reload();
  const restored=JSON.parse(await readFile(file,'utf8')) as SetupState;
  expect(restored).toEqual(after);expect(errors).toEqual([]);
});
test('a stale second tab cannot spend another reroll',async({page,context})=>{
  await page.goto('/');await page.getByRole('button',{name:'Khai mở thân phận'}).click();
  await expect(page.getByRole('button',{name:'Chấp nhận thân phận'})).toBeVisible();
  const second=await context.newPage();await second.goto('/');
  await page.getByRole('button',{name:/Đổi thân phận/}).click();await expect(page.getByTestId('free-rerolls')).toHaveText('2 / 3');
  await second.getByRole('button',{name:/Đổi thân phận/}).click();await expect(second.getByRole('alert').filter({hasText:'Dữ liệu'})).toContainText('Dữ liệu đã thay đổi');
  await second.reload();await expect(second.getByTestId('free-rerolls')).toHaveText('2 / 3');
});
test('mobile widths have no horizontal overflow and controls remain usable',async({page})=>{
  for(const width of [320,390,768]) {
    await page.setViewportSize({width,height:844});await page.goto('/');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:/^Hậu cung/}).click();
  await page.getByRole('button',{name:'Khai mở thân phận'}).click();
  await expect(page.getByRole('button',{name:'Chấp nhận thân phận'})).toBeVisible();
  await page.mouse.move(0,0);
  await expect(page.locator('.reroll-button')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await page.screenshot({path:'/tmp/dai-noi-ky-mobile.png',fullPage:true});
});
