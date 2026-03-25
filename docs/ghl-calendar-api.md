# GHL Calendar API Reference

**Base URL:** `https://services.leadconnectorhq.com`
**API Version:** `2021-04-15` (required `Version` header on every request)
**Auth:** `Authorization: Bearer <TOKEN>` (Sub-Account token)

## Scopes

| Scope | Access |
|---|---|
| `calendars.readonly` | Read calendars, schedules |
| `calendars.write` | Create/update/delete calendars, schedules |
| `calendars/groups.readonly` | Read calendar groups |
| `calendars/groups.write` | Create/update/delete calendar groups |
| `calendars/events.readonly` | Read events, appointments, blocked slots, notifications |
| `calendars/events.write` | Create/update/delete events, appointments, block slots, notes, notifications |
| `calendars/resources.readonly` | Read rooms & equipment resources |
| `calendars/resources.write` | Create/update/delete resources |

---

## 1. Calendars

### Calendar Object Schema

| Field | Type | Notes |
|---|---|---|
| id | string | Unique calendar ID |
| locationId | string | Sub-account location ID (required) |
| name | string | Calendar name (required) |
| calendarType | string | `round_robin`, `event`, `class_booking`, `collective`, `service_booking`, `personal` |
| eventType | string | `RoundRobin_OptimizeForAvailability` or `RoundRobin_OptimizeForEqualDistribution` |
| description | string | Optional description |
| slug | string | URL slug (not always present) |
| widgetSlug | string | Widget URL slug (always present) |
| widgetType | string | `default` (neo layout) or `classic` |
| isActive | boolean | Active or draft (default: true) |
| groupId | string | Optional group ID |
| teamMembers | array | Required for Round Robin, Collective, Class, Service types |
| eventTitle | string | Event title template (default: `{{contact.name}}`) |
| eventColor | string | Hex color (default: `#039be5`) |
| slotDuration | number | Meeting duration in minutes (default: 30) |
| slotDurationUnit | string | `mins` or `hours` |
| slotInterval | number | Time between booking slots shown (default: 30) |
| slotIntervalUnit | string | `mins` or `hours` |
| slotBuffer | number | Buffer time after appointment |
| slotBufferUnit | string | `mins` or `hours` |
| preBuffer | number | Buffer time before appointment |
| preBufferUnit | string | `mins` or `hours` |
| appoinmentPerSlot | number | Max bookings per slot per user (default: 1) |
| appoinmentPerDay | number | Max bookings per day |
| allowBookingAfter | number | Minimum scheduling notice |
| allowBookingAfterUnit | string | `mins`, `hours`, `days`, `weeks`, `months` |
| allowBookingFor | number | Booking window length |
| allowBookingForUnit | string | `days`, `weeks`, `months` |
| formId | string | Linked form ID |
| stickyContact | boolean | Sticky contact setting |
| autoConfirm | boolean | Auto-confirm bookings (default: true) |
| allowReschedule | boolean | (default: true) |
| allowCancellation | boolean | (default: true) |
| googleInvitationEmails | boolean | Send Google invite emails (default: false) |
| formSubmitType | string | `ThankYouMessage` or `RedirectURL` |
| formSubmitRedirectURL | string | Redirect URL after form submit |
| formSubmitThanksMessage | string | Thank-you message after form submit |
| guestType | string | `count_only` or `collect_detail` |
| consentLabel | string | Consent checkbox label |
| calendarCoverImage | string | Cover image URL |
| enableRecurring | boolean | Enable recurring appointments (default: false) |
| recurring | object | `{ freq, count, bookingOption, bookingOverlapDefaultStatus }` |
| locationConfigurations | array | Event-level meeting location configs |
| lookBusyConfig | object | `{ enabled: boolean, LookBusyPercentage: number }` |
| pixelId | string | Tracking pixel ID |
| notes | string | Internal notes |

**teamMembers item:**
```json
{
  "userId": "string",
  "priority": 0.5,
  "isPrimary": true,
  "selected": true,
  "locationConfigurations": [
    {
      "kind": "custom|zoom_conference|google_conference|inbound_call|outbound_call|physical|booker|ms_teams_conference",
      "location": "string",
      "meetingId": "string"
    }
  ]
}
```

### GET /calendars/

Get all calendars in a location.

**Scope:** `calendars.readonly`

| Param | Type | Required | Notes |
|---|---|---|---|
| locationId | string | Yes | Sub-account location ID |
| groupId | string | No | Filter by group |
| showDrafted | boolean | No | Include drafts (default: true) |

**Response 200:** `{ "calendars": [CalendarObject] }`

### POST /calendars/

Create a calendar. `locationId` and `name` are required.

**Scope:** `calendars.write`
**Response 200:** `{ "calendar": CalendarObject }`

### GET /calendars/:calendarId

Get calendar by ID.

**Scope:** `calendars.readonly`
**Response 200:** `{ "calendar": CalendarObject }`

### PUT /calendars/:calendarId

Update calendar by ID. Partial update supported.

**Scope:** `calendars.write`
**Response 200:** `{ "calendar": CalendarObject }`

### DELETE /calendars/:calendarId

Delete calendar by ID.

**Scope:** `calendars.write`
**Response 200:** `{ "success": "true" }`

### GET /calendars/:calendarId/free-slots

Get free booking slots for a date range (max 31 days).

**Scope:** `calendars.readonly`

| Param | Type | Required | Notes |
|---|---|---|---|
| startDate | number | Yes | Unix timestamp ms |
| endDate | number | Yes | Unix timestamp ms |
| timezone | string | No | IANA timezone (e.g., `America/Chicago`) |
| userId | string | No | Filter for a specific user |
| userIds | string[] | No | Filter for multiple users |

**Response 200:**
```json
{
  "2024-10-28": { "slots": ["2024-10-28T10:00:00-05:00", "2024-10-28T11:00:00-05:00"] },
  "2024-10-29": { "slots": ["2024-10-29T10:00:00-05:00"] }
}
```

---

## 2. Calendar Groups

Groups organize calendars together (e.g., for team pages). Each group has a slug and active state.

### Group Object

| Field | Type | Notes |
|---|---|---|
| id | string | Group ID |
| locationId | string | Sub-account location ID |
| name | string | Group name |
| description | string | Group description |
| slug | string | URL slug |
| isActive | boolean | Active state |

### GET /calendars/groups

**Scope:** `calendars/groups.readonly`
**Query:** `locationId` (required)
**Response 200:** `{ "groups": [GroupObject] }`

### POST /calendars/groups

**Scope:** `calendars/groups.write`
**Body:** `{ locationId, name, description, slug, isActive }`
**Response 201:** `{ "group": GroupObject }`

### POST /calendars/groups/validate-slug

Validate group slug availability.

**Scope:** `calendars/groups.write`
**Body:** `{ "locationId": "string", "slug": "string" }`
**Response 200:** `{ "available": true }`

### PUT /calendars/groups/:groupId

**Scope:** `calendars/groups.write`
**Body:** `{ name, description, slug }` (all required)
**Response 200:** `{ "group": GroupObject }`

### PUT /calendars/groups/:groupId/status

Enable or disable a group.

**Scope:** `calendars/groups.write`
**Body:** `{ "isActive": boolean }`
**Response 200:** `{ "success": "true" }`

### DELETE /calendars/groups/:groupId

**Scope:** `calendars/groups.write`
**Response 200:** `{ "success": "true" }`

---

## 3. Calendar Events & Appointments

### Event Object

| Field | Type | Notes |
|---|---|---|
| id | string | Event ID or recurring instance ID |
| calendarId | string | Calendar ID |
| locationId | string | Location ID |
| contactId | string | Contact ID |
| groupId | string | Group ID |
| title | string | Event title |
| address | string | Meeting URL or address |
| appointmentStatus | string | `new`, `confirmed`, `cancelled`, `showed`, `noshow`, `invalid`, `completed`, `active` |
| assignedUserId | string | Primary owner |
| users | string[] | Secondary owners |
| notes | string | Internal notes |
| description | string | Event description |
| startTime | ISO8601 | Start time |
| endTime | ISO8601 | End time |
| dateAdded | ISO8601 | Creation timestamp |
| dateUpdated | ISO8601 | Last update timestamp |
| isRecurring | boolean | Whether event is recurring |
| rrule | string | iCalendar RRULE (RFC 5545) |
| masterEventId | string | Master event ID for recurring instances |
| assignedResources | string[] | Room/equipment resource IDs |
| createdBy | object | `{ userId, source }` |
| deleted | boolean | Soft-delete flag |

**Recurring event ID format:** `{eventId}_{startTimeUnix}_{durationSeconds}`

### GET /calendars/events

Get events in a time range. One of `userId`, `calendarId`, or `groupId` is required.

**Scope:** `calendars/events.readonly`

| Param | Type | Required | Notes |
|---|---|---|---|
| locationId | string | Yes | |
| startTime | string | Yes | Epoch milliseconds |
| endTime | string | Yes | Epoch milliseconds |
| userId | string | No* | Filter by user |
| calendarId | string | No* | Filter by calendar |
| groupId | string | No* | Filter by group |

**Response 200:** `{ "events": [EventObject] }`

### GET /calendars/blocked-slots

Same parameters as GET /calendars/events. Returns block-slot events.

**Scope:** `calendars/events.readonly`
**Response 200:** `{ "events": [EventObject] }`

### GET /calendars/events/appointments/:eventId

Get appointment by ID. Supports recurring instance IDs.

**Scope:** `calendars/events.readonly`
**Response 200:** `{ "event": EventObject }`

### POST /calendars/events/appointments

Create an appointment.

**Scope:** `calendars/events.write`

| Field | Type | Required | Notes |
|---|---|---|---|
| calendarId | string | Yes | |
| locationId | string | Yes | |
| contactId | string | Yes | |
| startTime | string | Yes | ISO 8601 with timezone |
| endTime | string | No | ISO 8601 |
| title | string | No | |
| appointmentStatus | string | No | |
| assignedUserId | string | No | |
| description | string | No | |
| address | string | No | |
| meetingLocationType | string | No | `custom`, `zoom`, `gmeet`, `phone`, `address`, `ms_teams`, `google` |
| meetingLocationId | string | No | ID from calendar.locationConfigurations |
| overrideLocationConfig | boolean | No | true = use meetingLocationType |
| ignoreDateRange | boolean | No | Skip scheduling notice checks |
| ignoreFreeSlotValidation | boolean | No | Skip free-slot validation |
| toNotify | boolean | No | false = suppress automations |
| rrule | string | No | RRULE for recurring (only if ignoreFreeSlotValidation is true) |

**Response 200:** EventObject (flat, not nested)

### PUT /calendars/events/appointments/:eventId

Update an appointment. Use `masterEventId` to modify entire recurring series.

**Scope:** `calendars/events.write`
**Response 200:** EventObject

### POST /calendars/events/block-slots

Block time on a calendar or for a user.

**Scope:** `calendars/events.write`

| Field | Required | Notes |
|---|---|---|
| locationId | Yes | |
| calendarId | No* | Either calendarId or assignedUserId |
| assignedUserId | No* | Either calendarId or assignedUserId |
| title | No | |
| startTime | No | ISO 8601 |
| endTime | No | ISO 8601 |

**Response 201:** Block slot object

### PUT /calendars/events/block-slots/:eventId

Update a block slot. Same body as create.

### DELETE /calendars/events/:eventId

Delete an event. Use recurring instance ID for single occurrence, masterEventId for full series.

**Scope:** `calendars/events.write`
**Body:** `{}` (empty object required)
**Response 201:** `{ "succeeded": true }`

---

## 4. Appointment Notes

Notes attached to individual appointments.

```json
{
  "id": "string",
  "body": "lorem ipsum",
  "userId": "string",
  "dateAdded": "2021-07-08T12:02:11.285Z",
  "contactId": "string",
  "createdBy": { "id": "string", "name": "John Doe" }
}
```

### GET /calendars/appointments/:appointmentId/notes

**Query:** `limit` (required, max 20), `offset` (required)
**Response 200:** `{ "notes": [NoteObject], "hasMore": boolean }`

### POST /calendars/appointments/:appointmentId/notes

**Body:** `{ "userId": "string", "body": "string (max 5000 chars)" }`
**Response 201:** `{ "note": NoteObject }`

### PUT /calendars/appointments/:appointmentId/notes/:noteId

**Body:** `{ "userId": "string", "body": "string" }`
**Response 200:** `{ "note": NoteObject }`

### DELETE /calendars/appointments/:appointmentId/notes/:noteId

**Response 200:** `{ "success": true }`

---

## 5. Calendar Notifications

Replaces the deprecated `notifications` field on the calendar object.

### Notification Object

| Field | Type | Notes |
|---|---|---|
| _id | string | Notification ID |
| receiverType | string | `contact`, `guest`, `assignedUser`, `emails`, `phoneNumbers`, `business` |
| channel | string | `email`, `inApp`, `sms`, `whatsapp` |
| notificationType | string | `booked`, `confirmation`, `cancellation`, `reminder`, `followup`, `reschedule` |
| isActive | boolean | |
| templateId | string | Email template ID |
| body | string | Notification body |
| subject | string | Email subject |
| beforeTime | array | `[{ timeOffset, unit }]` — for reminder type |
| afterTime | array | `[{ timeOffset, unit }]` — for follow-up type |
| additionalEmailIds | string[] | Extra email recipients |
| additionalPhoneNumbers | string[] | Extra SMS/WhatsApp recipients |
| selectedUsers | string[] | User IDs or `"sub_account_admin"` for in-app/business |
| deleted | boolean | Soft-delete flag |

### GET /calendars/:calendarId/notifications

**Query:** `isActive`, `deleted`, `limit` (default 100), `skip` (default 0)
**Response 200:** `[NotificationObject]`

### POST /calendars/:calendarId/notifications

Create one or multiple notifications (array body).
**Response 200:** `[NotificationObject]`

### GET /calendars/:calendarId/notifications/:notificationId

**Response 200:** `NotificationObject`

### PUT /calendars/:calendarId/notifications/:notificationId

Partial update. Set `deleted: true` for soft delete.
**Response 200:** `{ "message": "string" }`

### DELETE /calendars/:calendarId/notifications/:notificationId

**Response 200:** `{ "message": "string" }`

---

## 6. Availability Schedules

Define when a user is bookable. Replaces deprecated `openHours`/`availabilities` fields.

### Schedule Object

| Field | Type | Notes |
|---|---|---|
| id | string | Schedule ID |
| name | string | Human-readable name |
| locationId | string | |
| userId | string | Associated user |
| calendarIds | string[] | Calendars this schedule applies to |
| timezone | string | IANA timezone |
| rules | array | See below |
| dateAdded | ISO8601 | |
| dateUpdated | ISO8601 | |
| deleted | boolean | |

**Rule object:**
```json
{
  "type": "wday | date",
  "day": "monday",
  "date": "2023-04-15",
  "intervals": [{ "from": "09:00", "to": "17:00" }]
}
```

### GET /calendars/schedules/search

**Query:** `locationId` (required), `userId` (required), `calendarId` (optional), `skip`, `limit` (1-500, default 50)
**Response 200:** `{ "schedules": [ScheduleObject] }`

### POST /calendars/schedules

**Body:** `{ rules, timezone, locationId, name, userId, calendarIds[] }` — all required except calendarIds.
**Response 201:** `{ "schedule": ScheduleObject }`

### GET /calendars/schedules/:scheduleId

**Response 200:** `{ "schedule": ScheduleObject }`

### PUT /calendars/schedules/:scheduleId

Partial update.

### DELETE /calendars/schedules/:scheduleId

Permanent delete. Cannot be undone.

### PUT /calendars/schedules/:scheduleId/add-calendar

Associate a calendar with the schedule.

### DELETE /calendars/schedules/:scheduleId/remove-calendar

Remove calendar from schedule.

### POST /calendars/:calendarId/schedule

Create availability schedule for an event calendar.

### GET /calendars/:calendarId/schedule

Get availability schedule for an event calendar.

### PUT /calendars/:calendarId/schedule

Update availability schedule for an event calendar.

---

## 7. Calendar Resources (Rooms & Equipment)

> **Deprecated** — May be removed in future API versions.

### Resource Object

| Field | Type | Notes |
|---|---|---|
| locationId | string | Required |
| name | string | Required |
| resourceType | string | `rooms` or `equipments` |
| isActive | boolean | Required |
| description | string | |
| quantity | number | Equipment quantity |
| outOfService | number | Quantity currently out of service |
| capacity | number | Room capacity |
| calendarIds | string[] | Service calendars mapped (max 100) |

- One equipment → one service calendar only
- One room → multiple service calendars

### Endpoints

- **GET** `/calendars/resources/:resourceType` — List resources (`locationId`, `limit`, `skip` required)
- **POST** `/calendars/resources/:resourceType` — Create resource
- **GET** `/calendars/resources/:resourceType/:id` — Get by ID
- **PUT** `/calendars/resources/:resourceType/:id` — Update
- **DELETE** `/calendars/resources/:resourceType/:id` — Delete

---

## Key Notes

- **Version header:** Must be `2021-04-15`, not the default `2021-07-28` used by other GHL endpoints.
- **Recurring events:** Use RRULE strings (RFC 5545). Instance IDs: `{masterEventId}_{startUnixMs}_{durationSecs}`.
- **Slot validation bypass:** `ignoreFreeSlotValidation: true` skips all slot checks when creating appointments.
- **Suppress automations:** `toNotify: false` when creating/updating appointments.
- **Deprecated fields:** `notifications`, `openHours`, `availabilities` on calendar object, `meetingLocationType`/`meetingLocation` on team members, all `/calendars/resources/*` endpoints.

## Error Responses

```json
// 400
{ "statusCode": 400, "message": "Bad Request" }

// 401
{ "statusCode": 401, "message": "Invalid token: access token is invalid", "error": "Unauthorized" }
```
