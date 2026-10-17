# Ranh giới package

Rà soát ngày 2026-10-16: chia theo trách nhiệm và chiều phụ thuộc, không theo việc file chứa type hay implementation. Interface riêng của module giữ cạnh module đó; interface dùng chung giữa các phần của một capability giữ trong package sở hữu capability. Không tạo một package interfaces chung cho queue, renderer, realtime và gameplay.

| Package | Sở hữu và quyết định |
| --- | --- |
| `jobs` | Queue ports và adapter BullMQ. Gộp hai package jobs-core/jobs-bullmq nhỏ thành một; root chỉ export type, `/bullmq` là entry thực thi riêng. |
| `realtime-core` | Ports cùng logic kết nối, room, presence, publisher và memory adapter; có runtime thực sự nên giữ riêng. |
| `realtime-redis` | Redis bus/store/coordination; chỉ phụ thuộc realtime-core trong workspace. |
| `realtime-fastify-ws` | WebSocket transport cho Fastify; chỉ phụ thuộc realtime-core trong workspace. |
| `render-contracts` | Renderer types, registry và xử lý pixel trung lập với engine. Hai renderer cùng dùng; giữ riêng, không chuyển vào contracts của API. |
| `renderer-phaser`, `renderer-canvas` | Hai adapter có runtime/dependency khác nhau; không nhập luật game hay code app. |
| `contracts` | DTO, command, lỗi, decoder/validation và wire contract client/server. Có runtime validation, không phải kho mọi interface của repo. |
| `character-core` | Metadata nhân vật, outfit/layout/animation và type nhân vật; không renderer hoặc app. |
| `game-content` | Catalog, cấu hình kinh tế và bản đồ, không phụ thuộc workspace khác. |
| `gameplay` | Luật nông trại thuần, dùng game-content. |
| `arcade-games` | Engine/luật/bot arcade; không UI hoặc backend. |
| `game-service` | Thao tác SDK trên PlayerDocument, dùng chung cho local/server; không storage, queue, transport hay rendering. |
| `api-sdk` | Ghép local/HTTP adapter và realtime client với public contracts. |
| `arcade-games-react` | UI, locale và wiring các game arcade, dùng engine/SDK contracts qua public exports. |
| `ui` | React controls/theme dùng chung; không biết nghiệp vụ game. |
| `game-audio` | Audio runtime dùng chung, không nghiệp vụ backend. |
| `apps/api` | Composition HTTP/worker, xác thực, domain service, repository và DB schema. Tên job/payload/lịch thuộc backend, không đưa vào jobs. |
| `apps/game` | Composition UI/renderer/SDK, feature state và assets; package không import ngược vào đây. |

## Queue sau rà soát

```ts
import type { Job, JobQueue, JobSchedule } from '@chibi-town/jobs';
import { createBullMqQueue } from '@chibi-town/jobs/bullmq';
```

`src/ports.ts` giữ interface, `src/index.ts` chỉ export type, `src/bullmq.ts` giữ adapter. Import root không nạp BullMQ/ioredis hoặc mở kết nối. BullMQ/ioredis vẫn được cài theo dependencies của jobs; đây là tách runtime entry, không phải tách gói cài đặt. Worker là nơi chọn adapter; background-jobs chỉ nhận JobQueue.

Chỉ nên tách contract thành package riêng khi có lý do cụ thể: các adapter/consumer có vòng đời độc lập, cần phân phối/cài đặt độc lập hoặc có yêu cầu không cài dependency của adapter. Một file vài interface và một adapter hiện tại chưa cần thêm workspace package.

## Kiểm tra ranh giới

`tools/tooling/package-boundaries.test.mjs` kiểm tra toàn bộ source của các shared package: dependency phải khai báo, import workspace qua public exports, relative import không vượt package, không import alias/app và không có vòng phụ thuộc runtime. Các nền tảng và adapter hạ tầng có danh sách dependency workspace cho phép để tránh kéo nghiệp vụ vào core. Contract root của jobs chỉ được chứa type hoặc export type; test entrypoint cũng chặn việc root nạp BullMQ/Redis.

Build/typecheck kiểm tra API thực tế của từng export; Redis integration kiểm tra queue/retry. Các kiểm tra kiến trúc không thay thế test nghiệp vụ hoặc transaction/idempotency của backend.
