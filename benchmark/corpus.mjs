// Original synthetic examples. Gold labels are never placed in the HTML or model state.
// Deliberately includes failure cases, not a representative or held-out web benchmark.
const page = (title, body, lang = 'en') => `<!doctype html><html lang="${lang}"><head><title>${title}</title></head><body>${body}</body></html>`;
export const cases = [
  {
    id: 'article-en', mode: 'article', language: 'en',
    html: page('A quieter reading room', `<nav><a href="/">City desk</a></nav><main><article><h1>A quieter reading room</h1><p>The library opened a reading room on Tuesday, with twenty desks, adjustable lamps, and a quiet area away from the entrance. Visitors can use the room without booking a seat.</p><p>Staff will collect feedback for six weeks before changing the opening hours. The trial is intended to learn whether readers prefer longer evening sessions or more weekend access.</p><p>The renovation reused shelves and repaired the existing windows. According to the project notes, the aim was to improve comfort while keeping the familiar layout of the building.</p></article></main><aside><p>Explore our weekend travel offers and book your next city break.</p></aside><footer>Site terms and advertising enquiries</footer>`),
    keep: ['The library opened a reading room on Tuesday', 'Staff will collect feedback for six weeks', 'The renovation reused shelves and repaired the existing windows'],
    drop: ['City desk', 'Explore our weekend travel offers', 'Site terms and advertising enquiries'],
  },
  {
    id: 'article-zh', mode: 'article', language: 'zh',
    html: page('社区花园的雨水实验', `<nav>首页与热门推荐</nav><main><article><h1>社区花园的雨水实验</h1><p>社区花园开始记录雨水收集情况。志愿者每天检查水桶刻度，把降雨量、灌溉次数和土壤湿度写入同一份记录，观察是否能减少自来水用量。</p><p>团队没有把一次降雨的效果当成长期结论。不同季节的温度和植物生长速度都会影响结果，因此需要持续记录并保留原始数据。</p><p>下一阶段会比较两块面积相同的菜地。一块使用收集的雨水，另一块维持原有浇灌方式，同时公开记录缺失和设备故障。</p></article></main><aside><p>限时领取园艺商城优惠券，立即进入活动页面。</p></aside><footer>版权声明与联系我们</footer>`, 'zh'),
    keep: ['社区花园开始记录雨水收集情况', '团队没有把一次降雨的效果当成长期结论', '下一阶段会比较两块面积相同的菜地'],
    drop: ['首页与热门推荐', '限时领取园艺商城优惠券', '版权声明与联系我们'],
  },
  {
    id: 'documentation', mode: 'documentation', language: 'en',
    html: page('Queue API guide', `<nav>API index and previous releases</nav><main><h1>Queue API guide</h1><p>Create a queue before submitting a job. The returned identifier is stable across retries and lets the client retrieve the final result without starting another execution.</p><h2>Submit a job</h2><pre><code>const job = await queue.submit({ task: 'index' });</code></pre><aside class="warning"><p>Do not retry a completed job with a new idempotency key.</p></aside><p>Poll the status endpoint until the job completes, then store the result. A failed job reports an error category so the caller can distinguish invalid input from temporary service failures.</p></main><footer>Documentation sponsor programme</footer>`),
    keep: ['Create a queue before submitting a job', "const job = await queue.submit({ task: 'index' });", 'Do not retry a completed job with a new idempotency key', 'Poll the status endpoint until the job completes'],
    drop: ['API index and previous releases', 'Documentation sponsor programme'],
  },
  {
    id: 'forum', mode: 'forum', language: 'en',
    html: page('Why does my worker run twice?', `<nav>Community categories and badges</nav><main><h1>Why does my worker run twice?</h1><article><p>My worker sometimes receives the same job twice after a connection failure. I need a way to keep retries from creating duplicate records while preserving the original request.</p></article><section class="comments"><p>Use the job identifier as an idempotency key and enforce a unique constraint in the database. A retry should read the existing result rather than insert another row.</p><p>Also test the interval between committing the transaction and acknowledging the message. A crash in that interval is a normal reason for the queue to deliver the job again.</p></section></main><aside><p>Members also enjoyed these unrelated gaming discussions.</p></aside><footer>Community advertising contact</footer>`),
    keep: ['My worker sometimes receives the same job twice', 'Use the job identifier as an idempotency key', 'Also test the interval between committing the transaction'],
    drop: ['Community categories and badges', 'Members also enjoyed these unrelated gaming discussions', 'Community advertising contact'],
  },
  {
    id: 'product', mode: 'product', language: 'en',
    html: page('Field notebook', `<nav>All departments and account settings</nav><main><h1>Field notebook</h1><p>A compact notebook for recording measurements outdoors. The stitched binding lies flat on a table and the cover includes a pocket for loose notes collected during field visits.</p><p>Price: 18 USD</p><table><tr><th>Material</th><td>Recycled paper</td></tr><tr><th>Pages</th><td>160 numbered pages</td></tr></table><p>Orders include one notebook without a pen. Store it in a dry place after use; the cover resists light splashes but is not intended for immersion in water.</p></main><aside><p>Customers also bought an unrelated desk calendar.</p></aside><footer>Affiliate and wholesale registration</footer>`),
    keep: ['A compact notebook for recording measurements outdoors', 'Price: 18 USD', '160 numbered pages', 'Orders include one notebook without a pen'],
    drop: ['All departments and account settings', 'Customers also bought an unrelated desk calendar', 'Affiliate and wholesale registration'],
  },
  {
    id: 'link-directory', mode: 'agent', language: 'en',
    html: page('Release downloads', `<nav>Corporate navigation</nav><main><h1>Release downloads</h1><p>Choose the package for your operating system.</p><ul><li><a href="/linux">Linux binary and checksum</a></li><li><a href="/mac">macOS binary and checksum</a></li><li><a href="/win">Windows binary and checksum</a></li></ul></main><footer>Tracking and advertising preferences</footer>`),
    keep: ['Choose the package for your operating system', 'Linux binary and checksum', 'macOS binary and checksum', 'Windows binary and checksum'],
    drop: ['Corporate navigation', 'Tracking and advertising preferences'],
  },
  {
    id: 'unmarked-promotion', mode: 'article', language: 'en',
    html: page('Repairing a wooden chair', `<main><article><h1>Repairing a wooden chair</h1><p>Inspect every joint before applying glue, and label the pieces so they can be assembled in the same order. Remove loose material without changing the shape of the original joint.</p><div><p>Get exclusive shopping deals delivered to your inbox every morning. Join our mailing list for partner offers and discounts unrelated to this repair guide.</p></div><p>Apply a thin layer of glue to both mating surfaces and use a clamp to hold the joint in alignment. Wipe away excess adhesive before it dries and leave the chair unloaded overnight.</p><p>After the glue cures, check that all four feet rest on the floor. Recheck the repaired joint under a light load before returning the chair to everyday use.</p></article></main><footer>Commercial partnership programme</footer>`),
    keep: ['Inspect every joint before applying glue', 'Apply a thin layer of glue to both mating surfaces', 'After the glue cures, check that all four feet rest on the floor'],
    drop: ['Get exclusive shopping deals delivered to your inbox', 'Join our mailing list for partner offers', 'Commercial partnership programme'],
  },
  {
    id: 'short-unmarked-content', mode: 'article', language: 'en',
    html: page('Service notice', `<nav>Account and subscriptions</nav><div id="content"><h1>Service notice</h1><p>Water is unavailable until noon.</p><p>Use the east entrance today.</p><p>Bring a reusable bottle.</p></div><footer>Marketing preferences</footer>`),
    keep: ['Water is unavailable until noon.', 'Use the east entrance today.', 'Bring a reusable bottle.'],
    drop: ['Account and subscriptions', 'Marketing preferences'],
  },
];
