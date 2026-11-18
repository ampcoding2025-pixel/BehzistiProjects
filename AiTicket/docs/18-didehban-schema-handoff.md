# DidehbanDb Schema Handoff (Read-Only)

**Engine:** SQL Server  · **Database:** `DidehbanDb`  · **Scan:** 2026-11-14
**Policy:** SELECT / metadata only — no INSERT/UPDATE/DELETE/DDL.
**Domain:** Behzisti (بهزیستی) case system; `Cookie` = case/ticket.

Give this file (or the JSON companions below) to another agent as the schema source of truth.

## Companion files

- `docs/_schema_scan/tables.json` — all tables + approx row counts
- `docs/_schema_scan/fks.json` — all foreign keys
- `docs/_schema_scan/columns.json` — all columns (3513)
- `docs/_schema_scan/schema-handoff-summary.json` — compact structured summary
- `docs/08-didban-inspection-notes.md` — domain notes
- `docs/12-didban-field-map.md` — product field map
- `docs/17-table-relation-kpi-catalog.md` — KPI catalog from relations

## Inventory

| Metric | Count |
|--------|------:|
| Tables | 196 |
| Non-empty | 115 |
| Empty | 81 |
| FK edges | 310 |
| Columns | 3513 |

## Core model

```
Cookie (case) 1:1 Inform (citizen/geo)
Cookie 1:N CookieFlow (workflow steps)
Cookie 1:N CookiePursuit (follow-ups)
Cookie 1:N Cartable (open workbasket)
Cookie -> Subject -> SubjectGroup / SubjectNature / Zone
Cookie -> SubjectClass, SubjectPriority, CookieChannel, CookieStatus, CookieType
Cookie -> Department, Flow, UserInfo, Agent
CookieFlow -> Cookie, CookieStatus (+Pre), Department, UserInfo, taxonomy
CallRecord -> Cookie / CookieFlow / CookiePursuit
AttachmentVisite -> Cookie, CookieStatus, UserInfo
Inbox -> Sentbox
DepartmentChart -> Department (parent/child)
```

## Tables (approx rows)

| Table | Approx rows | Empty |
|-------|------------:|:-----:|
| `HttpLog` | 1443762 |  |
| `CookieLog` | 668796 |  |
| `InformLog` | 668796 |  |
| `CookieFlow` | 632835 |  |
| `CallLogLog` | 605598 |  |
| `TotalSystemLog` | 484815 |  |
| `TrackUsers` | 290545 |  |
| `Sentbox` | 208823 |  |
| `InformerVisitorLog` | 205186 |  |
| `Cookie` | 193084 |  |
| `Inform` | 193084 |  |
| `CookiePursuit` | 150280 |  |
| `CallReceived` | 81214 |  |
| `AttachmentVisite` | 75721 |  |
| `AgentLog` | 73567 |  |
| `Agent` | 69517 |  |
| `AgentGroupMembership` | 50112 |  |
| `RoleMemberAccessLog` | 32188 |  |
| `CallRecord` | 31974 |  |
| `Cartable` | 30122 |  |
| `UserInfoLog` | 18419 |  |
| `DepartmentLog` | 13117 |  |
| `Inbox` | 9736 |  |
| `RoleMemberAccess` | 6821 |  |
| `SmsConfirmation` | 5900 |  |
| `SubjectClassMemberLog` | 5102 |  |
| `LoginLog` | 4176 |  |
| `MessageLog` | 3211 |  |
| `UserDevice` | 3178 |  |
| `AreaLog` | 2209 |  |
| `RoleMemberLog` | 2020 |  |
| `AccessLevel` | 1786 |  |
| `Department` | 1710 |  |
| `DepartmentChart` | 1710 |  |
| `SubjectlLog` | 1694 |  |
| `UserInfo` | 1538 |  |
| `WorkspaceMember` | 1533 |  |
| `SubjectClassMember` | 1289 |  |
| `AccessLevelLog` | 1226 |  |
| `MessageViewerLog` | 1167 |  |
| `RoleMember` | 909 |  |
| `deptemp` | 691 |  |
| `Feature` | 649 |  |
| `DepartmentChartLog` | 538 |  |
| `FlowNodeLog` | 486 |  |
| `Area` | 477 |  |
| `SubSystemLog` | 422 |  |
| `Subject` | 420 |  |
| `Subject-Copy-14040410` | 420 |  |
| `Calandar` | 372 |  |
| `NewSubj` | 296 |  |
| `NewSubj2` | 296 |  |
| `Message` | 230 |  |
| `CookieStatusLog` | 208 |  |
| `TempSubject` | 174 |  |
| `RegionLog` | 137 |  |
| `FeatureType` | 132 |  |
| `SubSystem` | 131 |  |
| `FlowNode` | 109 |  |
| `SubjectGroup` | 93 |  |
| `IVRCallLog` | 65 |  |
| `SubjectGroupLog` | 48 |  |
| `RoleLog` | 45 |  |
| `MessageReceiver` | 41 |  |
| `CookieStatusGroupLog` | 36 |  |
| `GeneralVariable` | 36 |  |
| `Region` | 33 |  |
| `CookieStatus` | 30 |  |
| `SubjectNature` | 30 |  |
| `TerminalStatus` | 29 |  |
| `ZoneLog` | 28 |  |
| `DepartmentTypeLog` | 25 |  |
| `Job` | 25 |  |
| `CenterCategory` | 19 |  |
| `DepartmentType` | 18 |  |
| `GeneralVariableLog` | 17 |  |
| `Role` | 15 |  |
| `CallLog` | 11 |  |
| `FeatureLog` | 11 |  |
| `CookieChannel` | 10 |  |
| `TotalSystem` | 10 |  |
| `CookieHint` | 8 |  |
| `Zone` | 8 |  |
| `CookieChannelLog` | 7 |  |
| `CookieFieldTypeCollection` | 7 |  |
| `FlowLog` | 7 |  |
| `AgentGroupMembershipLog` | 6 |  |
| `SubjectPriorityLog` | 6 |  |
| `AgentStatus` | 5 |  |
| `CallReceivedType` | 5 |  |
| `CookieStatusGroup` | 5 |  |
| `CookieType` | 5 |  |
| `EducationType` | 5 |  |
| `FAQ` | 5 |  |
| `AgentGroup` | 4 |  |
| `Flow` | 4 |  |
| `GenderLog` | 4 |  |
| `SubjectClass` | 4 |  |
| `WorkspaceLog` | 4 |  |
| `CookieTypeLog` | 3 |  |
| `ExternalService` | 3 |  |
| `FeedbackStatus` | 3 |  |
| `Gender` | 3 |  |
| `SubjectNatureLog` | 3 |  |
| `SubjectPriority` | 3 |  |
| `CookieHintType` | 2 |  |
| `FeatureTypeLog` | 2 |  |
| `FlowNodeCauseLog` | 2 |  |
| `MaritalStatus` | 2 |  |
| `SubjectClassLog` | 2 |  |
| `Workspace` | 2 |  |
| `WorkspaceMemberLog` | 2 |  |
| `CookieCause` | 1 |  |
| `CookieFlowDeleteLog` | 1 |  |
| `Library` | 1 |  |
| `AgentExpertiseField` | 0 | yes |
| `AgentExpertiseFieldLog` | 0 | yes |
| `AgentGift` | 0 | yes |
| `AgentGiftLog` | 0 | yes |
| `AgentGiftType` | 0 | yes |
| `AgentGiftTypeLog` | 0 | yes |
| `AgentGrade` | 0 | yes |
| `AgentGradeLog` | 0 | yes |
| `AgentGradeType` | 0 | yes |
| `AgentGradeTypeLog` | 0 | yes |
| `AgentGroupLog` | 0 | yes |
| `AgentSocialClass` | 0 | yes |
| `AgentSocialClassLog` | 0 | yes |
| `AgentStatusLog` | 0 | yes |
| `AppVersion` | 0 | yes |
| `BuildingStep` | 0 | yes |
| `ChatMessage` | 0 | yes |
| `ChatRoom` | 0 | yes |
| `ChatUser` | 0 | yes |
| `CheckList` | 0 | yes |
| `CheckListFlowNode` | 0 | yes |
| `ChkAnswer` | 0 | yes |
| `ChkGroupQuestion` | 0 | yes |
| `ChkQuestion` | 0 | yes |
| `ChkRecordedAnswer` | 0 | yes |
| `ChkRecordedAnswerIndex` | 0 | yes |
| `ContractorContract` | 0 | yes |
| `ContractorContractDepartment` | 0 | yes |
| `CookieCauseLog` | 0 | yes |
| `CookieComment` | 0 | yes |
| `CookieCommentDisAgree` | 0 | yes |
| `CookieFieldType` | 0 | yes |
| `CookieHintLog` | 0 | yes |
| `CookieHintTypeLog` | 0 | yes |
| `CookieShare` | 0 | yes |
| `CookieStatusAttachmentStep` | 0 | yes |
| `CookieSubjectChild` | 0 | yes |
| `CookieUserNotification` | 0 | yes |
| `DefaultUserSms` | 0 | yes |
| `Dictionary` | 0 | yes |
| `District` | 0 | yes |
| `DistrictLog` | 0 | yes |
| `Equip` | 0 | yes |
| `EquipMember` | 0 | yes |
| `Executer` | 0 | yes |
| `ExecuterLog` | 0 | yes |
| `ExecuterType` | 0 | yes |
| `ExecuterTypeLog` | 0 | yes |
| `FlowNodeCause` | 0 | yes |
| `Gift` | 0 | yes |
| `GiftLog` | 0 | yes |
| `GiftType` | 0 | yes |
| `GiftTypeLog` | 0 | yes |
| `JobLog` | 0 | yes |
| `MaritalStatusLog` | 0 | yes |
| `MayorMeeting` | 0 | yes |
| `MeetingMember` | 0 | yes |
| `Mission` | 0 | yes |
| `MissionLog` | 0 | yes |
| `MobileGISRequests` | 0 | yes |
| `NotificationSentbox` | 0 | yes |
| `Personnel` | 0 | yes |
| `PersonnelLog` | 0 | yes |
| `PursuitTemplate` | 0 | yes |
| `Referal` | 0 | yes |
| `Reminder` | 0 | yes |
| `ReportResult` | 0 | yes |
| `RoleStatusReports` | 0 | yes |
| `Segment` | 0 | yes |
| `ShiftType` | 0 | yes |
| `StatusMessage` | 0 | yes |
| `SubjectChild` | 0 | yes |
| `SubjectClassMemberReference` | 0 | yes |
| `SubjectIndex` | 0 | yes |
| `SubjectReference` | 0 | yes |
| `SubReport` | 0 | yes |
| `TotalSystemMenuLog` | 0 | yes |
| `TrackUserApp` | 0 | yes |
| `UserInfoGroup` | 0 | yes |
| `Vehicle` | 0 | yes |
| `VehicleType` | 0 | yes |

## Foreign keys

| From table | From column | To table | To column |
|------------|-------------|----------|-----------|
| `AccessLevel` | `FeatureId` | `Feature` | `FeatureId` |
| `AccessLevel` | `RoleId` | `Role` | `RoleId` |
| `Agent` | `AgentExpertiseFieldId` | `AgentExpertiseField` | `AgentExpertiseFieldId` |
| `Agent` | `AgentSocialClassId` | `AgentSocialClass` | `AgentSocialClassId` |
| `Agent` | `AreaId` | `Area` | `AreaId` |
| `Agent` | `DistrictId` | `District` | `DistrictId` |
| `Agent` | `EducationTypeId` | `EducationType` | `EducationTypeId` |
| `Agent` | `GenderId` | `Gender` | `GenderId` |
| `Agent` | `RegionId` | `Region` | `RegionId` |
| `AgentGift` | `AgentId` | `Agent` | `AgentId` |
| `AgentGift` | `AgentGiftTypeId` | `AgentGiftType` | `AgentGiftTypeId` |
| `AgentGrade` | `AgentId` | `Agent` | `AgentId` |
| `AgentGrade` | `AgentGradeTypeId` | `AgentGradeType` | `AgentGradeTypeId` |
| `AgentGroup` | `WorkspaceId` | `Workspace` | `WorkspaceId` |
| `AgentGroupMembership` | `AgentId` | `Agent` | `AgentId` |
| `AgentGroupMembership` | `AgentGroupId` | `AgentGroup` | `AgentGroupId` |
| `AgentGroupMembership` | `AgentStatusId` | `AgentStatus` | `AgentStatusId` |
| `Area` | `DepartmentId` | `Department` | `DepartmentId` |
| `Area` | `RegionId` | `Region` | `RegionId` |
| `Area` | `SegmentId` | `Segment` | `SegmentId` |
| `AttachmentVisite` | `CookieId` | `Cookie` | `CookieId` |
| `AttachmentVisite` | `CookieStatusId` | `CookieStatus` | `CookieStatusId` |
| `AttachmentVisite` | `RoleId` | `Role` | `RoleId` |
| `AttachmentVisite` | `UserId` | `UserInfo` | `UserId` |
| `CallLog` | `UserId` | `UserInfo` | `UserId` |
| `CallLog` | `WorkspaceId` | `Workspace` | `WorkspaceId` |
| `CallRecord` | `CookieId` | `Cookie` | `CookieId` |
| `CallRecord` | `CookieFlowId` | `CookieFlow` | `CookieFlowId` |
| `CallRecord` | `CookiePursuitId` | `CookiePursuit` | `CookiePursuitId` |
| `CallRecord` | `UserId` | `UserInfo` | `UserId` |
| `Cartable` | `CookieId` | `Cookie` | `CookieId` |
| `Cartable` | `CookieCauseId` | `CookieCause` | `CookieCauseId` |
| `Cartable` | `CookieChannelId` | `CookieChannel` | `CookieChannelId` |
| `Cartable` | `CartableFieldTypeId1` | `CookieFieldType` | `CookieFieldTypeId` |
| `Cartable` | `CartableFieldTypeId2` | `CookieFieldType` | `CookieFieldTypeId` |
| `Cartable` | `CartableFieldTypeId3` | `CookieFieldType` | `CookieFieldTypeId` |
| `Cartable` | `CartableFieldTypeId4` | `CookieFieldType` | `CookieFieldTypeId` |
| `Cartable` | `CartableFieldTypeId5` | `CookieFieldType` | `CookieFieldTypeId` |
| `Cartable` | `CookieFlowId` | `CookieFlow` | `CookieFlowId` |
| `Cartable` | `PreCookieFlowId` | `CookieFlow` | `CookieFlowId` |
| `Cartable` | `CookieStatusId` | `CookieStatus` | `CookieStatusId` |
| `Cartable` | `PreCookieStatusId` | `CookieStatus` | `CookieStatusId` |
| `Cartable` | `PreCookieStatusId` | `CookieStatus` | `CookieStatusId` |
| `Cartable` | `CookieTypeId` | `CookieType` | `CookieTypeId` |
| `Cartable` | `DepartmentId` | `Department` | `DepartmentId` |
| `Cartable` | `FlowId` | `Flow` | `FlowId` |
| `Cartable` | `AgentPersonnelId` | `Personnel` | `PersonnelId` |
| `Cartable` | `ExecuterPersonnelId` | `Personnel` | `PersonnelId` |
| `Cartable` | `CartableUserRoleId` | `Role` | `RoleId` |
| `Cartable` | `SubjectId` | `Subject` | `SubjectId` |
| `Cartable` | `SubjectClassId` | `SubjectClass` | `SubjectClassId` |
| `Cartable` | `SubjectGroupId` | `SubjectGroup` | `SubjectGroupId` |
| `Cartable` | `SubjectNatureId` | `SubjectNature` | `SubjectNatureId` |
| `Cartable` | `SubjectPriorityId` | `SubjectPriority` | `SubjectPriorityId` |
| `Cartable` | `CartableUserId` | `UserInfo` | `UserId` |
| `Cartable` | `CartableVisitedUserId` | `UserInfo` | `UserId` |
| `Cartable` | `ReferToUserId` | `UserInfo` | `UserId` |
| `Cartable` | `UserId` | `UserInfo` | `UserId` |
| `Cartable` | `ZoneId` | `Zone` | `ZoneId` |
| `CenterCategory` | `ParentId` | `CenterCategory` | `CenterCategoryId` |
| `ContractorContractDepartment` | `DepartmentId` | `Department` | `DepartmentId` |
| `Cookie` | `AgentId` | `Agent` | `AgentId` |
| `Cookie` | `EventId` | `Cookie` | `CookieId` |
| `Cookie` | `ReferringCookieId` | `Cookie` | `CookieId` |
| `Cookie` | `CookieCauseId` | `CookieCause` | `CookieCauseId` |
| `Cookie` | `CookieChannelId` | `CookieChannel` | `CookieChannelId` |
| `Cookie` | `CookieFieldTypeId1` | `CookieFieldType` | `CookieFieldTypeId` |
| `Cookie` | `CookieFieldTypeId2` | `CookieFieldType` | `CookieFieldTypeId` |
| `Cookie` | `CookieFieldTypeId3` | `CookieFieldType` | `CookieFieldTypeId` |
| `Cookie` | `CookieFieldTypeId4` | `CookieFieldType` | `CookieFieldTypeId` |
| `Cookie` | `CookieFieldTypeId5` | `CookieFieldType` | `CookieFieldTypeId` |
| `Cookie` | `CookieStatusId` | `CookieStatus` | `CookieStatusId` |
| `Cookie` | `CookieTypeId` | `CookieType` | `CookieTypeId` |
| `Cookie` | `DepartmentId` | `Department` | `DepartmentId` |
| `Cookie` | `PhoneBookDepartmentId` | `Department` | `DepartmentId` |
| `Cookie` | `FlowId` | `Flow` | `FlowId` |
| `Cookie` | `GiftId` | `Gift` | `GiftId` |
| `Cookie` | `GiftTypeId` | `GiftType` | `GiftTypeId` |
| `Cookie` | `AgentPersonnelId` | `Personnel` | `PersonnelId` |
| `Cookie` | `ExecuterPersonnelId` | `Personnel` | `PersonnelId` |
| `Cookie` | `CookieUserRoleId` | `Role` | `RoleId` |
| `Cookie` | `SubjectId` | `Subject` | `SubjectId` |
| `Cookie` | `SubjectClassId` | `SubjectClass` | `SubjectClassId` |
| `Cookie` | `SubjectGroupId` | `SubjectGroup` | `SubjectGroupId` |
| `Cookie` | `SubjectNatureId` | `SubjectNature` | `SubjectNatureId` |
| `Cookie` | `SubjectPriorityId` | `SubjectPriority` | `SubjectPriorityId` |
| `Cookie` | `CookieUserId` | `UserInfo` | `UserId` |
| `Cookie` | `CookieVisitedUserId` | `UserInfo` | `UserId` |
| `Cookie` | `UserId` | `UserInfo` | `UserId` |
| `Cookie` | `ZoneId` | `Zone` | `ZoneId` |
| `CookieCause` | `CookieTypeId` | `CookieType` | `CookieTypeId` |
| `CookieChannel` | `CookieTypeId` | `CookieType` | `CookieTypeId` |
| `CookieComment` | `CookieId` | `Cookie` | `CookieId` |
| `CookieComment` | `CookieFlowId` | `CookieFlow` | `CookieFlowId` |
| `CookieComment` | `RoleId` | `Role` | `RoleId` |
| `CookieComment` | `UserId` | `UserInfo` | `UserId` |
| `CookieCommentDisAgree` | `AgentId` | `Agent` | `AgentId` |
| `CookieCommentDisAgree` | `CookieId` | `Cookie` | `CookieId` |
| `CookieCommentDisAgree` | `CookieFlowId` | `CookieFlow` | `CookieFlowId` |
| `CookieCommentDisAgree` | `UserId` | `UserInfo` | `UserId` |
| `CookieFieldType` | `CookieTypeId` | `CookieType` | `CookieTypeId` |
| `CookieFlow` | `CookieId` | `Cookie` | `CookieId` |
| `CookieFlow` | `CookieCauseId` | `CookieCause` | `CookieCauseId` |
| `CookieFlow` | `CookieChannelId` | `CookieChannel` | `CookieChannelId` |
| `CookieFlow` | `CookieFlowFieldTypeId1` | `CookieFieldType` | `CookieFieldTypeId` |
| `CookieFlow` | `CookieFlowFieldTypeId2` | `CookieFieldType` | `CookieFieldTypeId` |
| `CookieFlow` | `CookieFlowFieldTypeId3` | `CookieFieldType` | `CookieFieldTypeId` |
| `CookieFlow` | `CookieFlowFieldTypeId4` | `CookieFieldType` | `CookieFieldTypeId` |
| `CookieFlow` | `CookieFlowFieldTypeId5` | `CookieFieldType` | `CookieFieldTypeId` |
| `CookieFlow` | `PreCookieFlowId` | `CookieFlow` | `CookieFlowId` |
| `CookieFlow` | `CookieStatusId` | `CookieStatus` | `CookieStatusId` |
| `CookieFlow` | `PreCookieStatusId` | `CookieStatus` | `CookieStatusId` |
| `CookieFlow` | `PreCookieStatusId` | `CookieStatus` | `CookieStatusId` |
| `CookieFlow` | `CookieTypeId` | `CookieType` | `CookieTypeId` |
| `CookieFlow` | `DepartmentId` | `Department` | `DepartmentId` |
| `CookieFlow` | `FlowId` | `Flow` | `FlowId` |
| `CookieFlow` | `AgentPersonnelId` | `Personnel` | `PersonnelId` |
| `CookieFlow` | `ExecuterPersonnelId` | `Personnel` | `PersonnelId` |
| `CookieFlow` | `CookieFlowUserRoleId` | `Role` | `RoleId` |
| `CookieFlow` | `SubjectId` | `Subject` | `SubjectId` |
| `CookieFlow` | `SubjectClassId` | `SubjectClass` | `SubjectClassId` |
| `CookieFlow` | `SubjectGroupId` | `SubjectGroup` | `SubjectGroupId` |
| `CookieFlow` | `SubjectNatureId` | `SubjectNature` | `SubjectNatureId` |
| `CookieFlow` | `SubjectPriorityId` | `SubjectPriority` | `SubjectPriorityId` |
| `CookieFlow` | `CookieFlowUserId` | `UserInfo` | `UserId` |
| `CookieFlow` | `CookieFlowVisitedUserId` | `UserInfo` | `UserId` |
| `CookieFlow` | `ReferToUserId` | `UserInfo` | `UserId` |
| `CookieFlow` | `UserId` | `UserInfo` | `UserId` |
| `CookieFlow` | `ZoneId` | `Zone` | `ZoneId` |
| `CookieHint` | `CookieId` | `Cookie` | `CookieId` |
| `CookieHint` | `ViaCookieId` | `Cookie` | `CookieId` |
| `CookieHint` | `CookieFlowId` | `CookieFlow` | `CookieFlowId` |
| `CookieHint` | `CookieHintTypeId` | `CookieHintType` | `CookieHintTypeId` |
| `CookieHint` | `RoleId` | `Role` | `RoleId` |
| `CookieHint` | `UserId` | `UserInfo` | `UserId` |
| `CookieLog` | `CookieId` | `Cookie` | `CookieId` |
| `CookieLog` | `DepartmentId` | `Department` | `DepartmentId` |
| `CookieLog` | `FlowId` | `Flow` | `FlowId` |
| `CookieLog` | `AgentPersonnelId` | `Personnel` | `PersonnelId` |
| `CookieLog` | `ExecuterPersonnelId` | `Personnel` | `PersonnelId` |
| `CookieLog` | `CookieLogUserRoleId` | `Role` | `RoleId` |
| `CookieLog` | `SubjectId` | `Subject` | `SubjectId` |
| `CookieLog` | `SubjectClassId` | `SubjectClass` | `SubjectClassId` |
| `CookieLog` | `SubjectGroupId` | `SubjectGroup` | `SubjectGroupId` |
| `CookieLog` | `SubjectNatureId` | `SubjectNature` | `SubjectNatureId` |
| `CookieLog` | `SubjectPriorityId` | `SubjectPriority` | `SubjectPriorityId` |
| `CookieLog` | `CookieLogUserId` | `UserInfo` | `UserId` |
| `CookieLog` | `UserId` | `UserInfo` | `UserId` |
| `CookieLog` | `ZoneId` | `Zone` | `ZoneId` |
| `CookiePursuit` | `CookieId` | `Cookie` | `CookieId` |
| `CookiePursuit` | `ViaCookieId` | `Cookie` | `CookieId` |
| `CookiePursuit` | `CookieChannelId` | `CookieChannel` | `CookieChannelId` |
| `CookiePursuit` | `CookieFlowId` | `CookieFlow` | `CookieFlowId` |
| `CookiePursuit` | `RoleId` | `Role` | `RoleId` |
| `CookiePursuit` | `UserId` | `UserInfo` | `UserId` |
| `CookieShare` | `CookieId` | `Cookie` | `CookieId` |
| `CookieShare` | `CookieFlowId` | `CookieFlow` | `CookieFlowId` |
| `CookieShare` | `RoleId` | `Role` | `RoleId` |
| `CookieShare` | `UserId` | `UserInfo` | `UserId` |
| `CookieStatus` | `CookieStatusGroupId` | `CookieStatusGroup` | `CookieStatusGroupId` |
| `CookieStatus` | `CookieTypeId` | `CookieType` | `CookieTypeId` |
| `CookieStatusAttachmentStep` | `CookieStatusId` | `CookieStatus` | `CookieStatusId` |
| `CookieStatusGroup` | `CookieTypeId` | `CookieType` | `CookieTypeId` |
| `CookieType` | `WorkspaceId` | `Workspace` | `WorkspaceId` |
| `CookieUserNotification` | `AgentId` | `Agent` | `AgentId` |
| `CookieUserNotification` | `CookieId` | `Cookie` | `CookieId` |
| `CookieUserNotification` | `UserId` | `UserInfo` | `UserId` |
| `DefaultUserSms` | `SubjectClassMemberId` | `SubjectClassMember` | `SubjectClassMemberId` |
| `DefaultUserSms` | `UserId` | `UserInfo` | `UserId` |
| `DefaultUserSms` | `UserGroupId` | `UserInfoGroup` | `UserGroupId` |
| `Department` | `AreaId` | `Area` | `AreaId` |
| `Department` | `DepartmentTypeId` | `DepartmentType` | `DepartmentTypeId` |
| `Department` | `FlowId` | `Flow` | `FlowId` |
| `Department` | `RegionId` | `Region` | `RegionId` |
| `DepartmentChart` | `DepartmentId` | `Department` | `DepartmentId` |
| `DepartmentChart` | `ParentDepartmentId` | `Department` | `DepartmentId` |
| `DepartmentChart` | `WorkspaceId` | `Workspace` | `WorkspaceId` |
| `DepartmentType` | `WorkspaceId` | `Workspace` | `WorkspaceId` |
| `District` | `RegionId` | `Region` | `RegionId` |
| `Equip` | `DepartmentId` | `Department` | `DepartmentId` |
| `Equip` | `ShiftTypeId` | `ShiftType` | `ShiftTypeId` |
| `Equip` | `VehicleId` | `Vehicle` | `VehicleId` |
| `EquipMember` | `EquipId` | `Equip` | `EquipId` |
| `EquipMember` | `JobId` | `Job` | `JobId` |
| `EquipMember` | `PersonnelId` | `Personnel` | `PersonnelId` |
| `Executer` | `DepartmentId` | `Department` | `DepartmentId` |
| `Executer` | `ExecuterTypeId` | `ExecuterType` | `ExecuterTypeId` |
| `Feature` | `FeatureTypeId` | `FeatureType` | `FeatureTypeId` |
| `Feature` | `SubSystemId` | `SubSystem` | `SubSystemId` |
| `Feature` | `TargetSubSystemId` | `SubSystem` | `SubSystemId` |
| `FeedbackStatus` | `CookieStatusId` | `CookieStatus` | `CookieStatusId` |
| `FeedbackStatus` | `CookieTypeId` | `CookieType` | `CookieTypeId` |
| `FeedbackStatus` | `RoleId` | `Role` | `RoleId` |
| `Flow` | `CookieTypeId` | `CookieType` | `CookieTypeId` |
| `Flow` | `DepartmentTypeId` | `DepartmentType` | `DepartmentTypeId` |
| `FlowNode` | `CookieHintTypeId` | `CookieHintType` | `CookieHintTypeId` |
| `FlowNode` | `CookieStatusId` | `CookieStatus` | `CookieStatusId` |
| `FlowNode` | `NextCookieStatusId` | `CookieStatus` | `CookieStatusId` |
| `FlowNode` | `FlowId` | `Flow` | `FlowId` |
| `FlowNode` | `RoleId` | `Role` | `RoleId` |
| `FlowNodeCause` | `CookieCauseId` | `CookieCause` | `CookieCauseId` |
| `FlowNodeCause` | `FlowNodeId` | `FlowNode` | `FlowNodeId` |
| `Gift` | `GiftTypeId` | `GiftType` | `GiftTypeId` |
| `Inbox` | `SentboxId` | `Sentbox` | `SentboxId` |
| `Inform` | `InformerAgentId` | `Agent` | `AgentId` |
| `Inform` | `InformerAgentGroupId` | `AgentGroup` | `AgentGroupId` |
| `Inform` | `InformerSocialClassId` | `AgentSocialClass` | `AgentSocialClassId` |
| `Inform` | `AreaId` | `Area` | `AreaId` |
| `Inform` | `InformerAreaId` | `Area` | `AreaId` |
| `Inform` | `CenterCategoryId` | `CenterCategory` | `CenterCategoryId` |
| `Inform` | `CookieId` | `Cookie` | `CookieId` |
| `Inform` | `DepartmentIdPlaceOccur` | `Department` | `DepartmentId` |
| `Inform` | `DistrinctId` | `District` | `DistrictId` |
| `Inform` | `InformerDistrinctId` | `District` | `DistrictId` |
| `Inform` | `InformerEducationTypeId` | `EducationType` | `EducationTypeId` |
| `Inform` | `InformerGenderId` | `Gender` | `GenderId` |
| `Inform` | `InformerRegionId` | `Region` | `RegionId` |
| `Inform` | `RegionId` | `Region` | `RegionId` |
| `Inform` | `SegmentId` | `Segment` | `SegmentId` |
| `InformerVisitorLog` | `CookieId` | `Cookie` | `CookieId` |
| `InformerVisitorLog` | `UserId` | `UserInfo` | `UserId` |
| `InformLog` | `InformLogerAgentId` | `Agent` | `AgentId` |
| `InformLog` | `InformLogerAgentGroupId` | `AgentGroup` | `AgentGroupId` |
| `InformLog` | `InformLogerSocialClassId` | `AgentSocialClass` | `AgentSocialClassId` |
| `InformLog` | `AreaId` | `Area` | `AreaId` |
| `InformLog` | `InformLogerAreaId` | `Area` | `AreaId` |
| `InformLog` | `CookieId` | `Cookie` | `CookieId` |
| `InformLog` | `DistrinctId` | `District` | `DistrictId` |
| `InformLog` | `InformLogerDistrinctId` | `District` | `DistrictId` |
| `InformLog` | `InformLogerEducationTypeId` | `EducationType` | `EducationTypeId` |
| `InformLog` | `InformLogerGenderId` | `Gender` | `GenderId` |
| `InformLog` | `InformId` | `Inform` | `InformId` |
| `InformLog` | `InformLogerRegionId` | `Region` | `RegionId` |
| `InformLog` | `RegionId` | `Region` | `RegionId` |
| `InformLog` | `SegmentId` | `Segment` | `SegmentId` |
| `Library` | `LibraryParentId` | `Library` | `LibraryId` |
| `MeetingMember` | `CookieId` | `Cookie` | `CookieId` |
| `MeetingMember` | `MayorMeetingId` | `MayorMeeting` | `MayorMeetingId` |
| `Message` | `MessageSenderUserId` | `UserInfo` | `UserId` |
| `MessageReceiver` | `MessageReceiverAgentId` | `Agent` | `AgentId` |
| `MessageReceiver` | `MessageId` | `Message` | `MessageId` |
| `MessageReceiver` | `MessageReceiverUserId` | `UserInfo` | `UserId` |
| `MessageViewerLog` | `AgentId` | `Agent` | `AgentId` |
| `MessageViewerLog` | `MessageId` | `Message` | `MessageId` |
| `MessageViewerLog` | `UserId` | `UserInfo` | `UserId` |
| `Mission` | `AreaId` | `Area` | `AreaId` |
| `Mission` | `CookieId` | `Cookie` | `CookieId` |
| `Mission` | `DistrictId` | `District` | `DistrictId` |
| `Mission` | `RegionId` | `Region` | `RegionId` |
| `MissionLog` | `AreaId` | `Area` | `AreaId` |
| `MissionLog` | `CookieId` | `Cookie` | `CookieId` |
| `MissionLog` | `DistrictId` | `District` | `DistrictId` |
| `MissionLog` | `RegionId` | `Region` | `RegionId` |
| `NotificationSentbox` | `RoleId` | `Role` | `RoleId` |
| `NotificationSentbox` | `UserId` | `UserInfo` | `UserId` |
| `NotificationSentbox` | `WorkspaceId` | `Workspace` | `WorkspaceId` |
| `Personnel` | `DepartmentId` | `Department` | `DepartmentId` |
| `Personnel` | `EducationTypeId` | `EducationType` | `EducationTypeId` |
| `Personnel` | `GenderId` | `Gender` | `GenderId` |
| `Personnel` | `JobId` | `Job` | `JobId` |
| `Personnel` | `MaritalStatusId` | `MaritalStatus` | `MaritalStatusId` |
| `Personnel` | `SupervisorId` | `Personnel` | `PersonnelId` |
| `Region` | `DepartmentId` | `Department` | `DepartmentId` |
| `ReportResult` | `RoleId` | `Role` | `RoleId` |
| `ReportResult` | `UserId` | `UserInfo` | `UserId` |
| `Role` | `WorkspaceId` | `Workspace` | `WorkspaceId` |
| `RoleMember` | `RoleId` | `Role` | `RoleId` |
| `RoleMember` | `RoleMemberId` | `RoleMember` | `RoleMemberId` |
| `RoleMember` | `UserId` | `UserInfo` | `UserId` |
| `RoleMemberAccess` | `CookieChannelId` | `CookieChannel` | `CookieChannelId` |
| `RoleMemberAccess` | `ChangedDepartmentId` | `Department` | `DepartmentId` |
| `RoleMemberAccess` | `DepartmentId` | `Department` | `DepartmentId` |
| `RoleMemberAccess` | `RoleMemberId` | `RoleMember` | `RoleMemberId` |
| `RoleStatusReports` | `RoleId` | `Role` | `RoleId` |
| `Segment` | `WorkspaceId` | `Workspace` | `WorkspaceId` |
| `Subject` | `CookieTypeId` | `CookieType` | `CookieTypeId` |
| `Subject` | `SubjectGroupId` | `SubjectGroup` | `SubjectGroupId` |
| `Subject` | `SubjectNatureId` | `SubjectNature` | `SubjectNatureId` |
| `Subject` | `ZoneId` | `Zone` | `ZoneId` |
| `SubjectChild` | `SubjectId` | `Subject` | `SubjectId` |
| `SubjectClass` | `CookieTypeId` | `CookieType` | `CookieTypeId` |
| `SubjectClassMember` | `SubjectClassMemberCookieFieldTypeId1` | `CookieFieldType` | `CookieFieldTypeId` |
| `SubjectClassMember` | `SubjectClassMemberCookieFieldTypeId2` | `CookieFieldType` | `CookieFieldTypeId` |
| `SubjectClassMember` | `SubjectClassMemberCookieFieldTypeId3` | `CookieFieldType` | `CookieFieldTypeId` |
| `SubjectClassMember` | `SubjectClassMemberCookieFieldTypeId4` | `CookieFieldType` | `CookieFieldTypeId` |
| `SubjectClassMember` | `SubjectClassMemberCookieFieldTypeId5` | `CookieFieldType` | `CookieFieldTypeId` |
| `SubjectClassMember` | `DepartmentId` | `Department` | `DepartmentId` |
| `SubjectClassMember` | `DepartmentTypeId` | `DepartmentType` | `DepartmentTypeId` |
| `SubjectClassMember` | `FlowId` | `Flow` | `FlowId` |
| `SubjectClassMember` | `SubjectId` | `Subject` | `SubjectId` |
| `SubjectClassMember` | `SubjectClassId` | `SubjectClass` | `SubjectClassId` |
| `SubjectClassMember` | `SubjectIndexId` | `SubjectIndex` | `SubjectIndexId` |
| `SubjectClassMember` | `SubjectPriorityId` | `SubjectPriority` | `SubjectPriorityId` |
| `SubjectGroup` | `CookieTypeId` | `CookieType` | `CookieTypeId` |
| `SubjectNature` | `CookieTypeId` | `CookieType` | `CookieTypeId` |
| `SubjectPriority` | `CookieTypeId` | `CookieType` | `CookieTypeId` |
| `SubSystem` | `TotalSystemId` | `TotalSystem` | `TotalSystemId` |
| `TerminalStatus` | `CookieStatusId` | `CookieStatus` | `CookieStatusId` |
| `TrackUserApp` | `UserId` | `UserInfo` | `UserId` |
| `TrackUsers` | `CookieChannelId` | `CookieChannel` | `CookieChannelId` |
| `TrackUsers` | `TrackUserId` | `UserInfo` | `UserId` |
| `UserDevice` | `AgentId` | `Agent` | `AgentId` |
| `UserDevice` | `GenderId` | `Gender` | `GenderId` |
| `UserInfo` | `PersonnelId` | `Personnel` | `PersonnelId` |
| `UserInfo` | `UserGroupId` | `UserInfoGroup` | `UserGroupId` |
| `Vehicle` | `DepartmentId` | `Department` | `DepartmentId` |
| `Vehicle` | `VehicleTypeId` | `VehicleType` | `VehicleTypeId` |
| `WorkspaceMember` | `UserId` | `UserInfo` | `UserId` |
| `WorkspaceMember` | `WorkspaceId` | `Workspace` | `WorkspaceId` |
| `Zone` | `CookieTypeId` | `CookieType` | `CookieTypeId` |

## Columns — core / high-value tables

### `Cookie` (~193084 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `CookieId` | bigint | no |
| `CookieYear` | int | no |
| `CookieNo` | bigint | no |
| `CookieTrackingNo` | bigint | no |
| `CookieCaption` | nvarchar(500) | yes |
| `CookieCaptionZiped` | nvarchar(500) | yes |
| `CookieText` | nvarchar(8000) | yes |
| `CookieTextZiped` | nvarchar(8000) | yes |
| `CookieDesc` | nvarchar(8000) | yes |
| `CookieDescZiped` | nvarchar(8000) | yes |
| `CookieTime` | datetime | no |
| `CookieTimeSolar` | char(16) | no |
| `CookieSubmitTime` | datetime | yes |
| `CookieSubmitTimeSolar` | char(16) | yes |
| `CookieFinishTime` | datetime | yes |
| `CookieFinishTimeSolar` | char(16) | yes |
| `CookieLastActionTime` | datetime | yes |
| `CookieLastActionTimeSolar` | char(16) | yes |
| `CookiePreLastActionTime` | datetime | yes |
| `CookiePreLastActionTimeSolar` | char(16) | yes |
| `CookieActionTime` | datetime | yes |
| `CookieActionTimeSolar` | char(16) | yes |
| `CookieRequiredTime` | datetime | yes |
| `CookieRequiredTimeSolar` | char(16) | yes |
| `CookieAttribute1` | nvarchar(200) | yes |
| `CookieAttribute2` | nvarchar(200) | yes |
| `CookieAttribute3` | nvarchar(200) | yes |
| `CookieAttribute4` | nvarchar(200) | yes |
| `CookieAttribute5` | nvarchar(200) | yes |
| `CookieIntAttribute1` | int | yes |
| `CookieIntAttribute2` | int | yes |
| `CookieIntAttribute3` | int | yes |
| `CookieIntAttribute4` | int | yes |
| `CookieIntAttribute5` | int | yes |
| `CookieFieldTypeId1` | int | yes |
| `CookieField1` | nvarchar(100) | yes |
| `CookieFieldTypeId2` | int | yes |
| `CookieField2` | nvarchar(100) | yes |
| `CookieFieldTypeId3` | int | yes |
| `CookieField3` | nvarchar(100) | yes |
| `CookieFieldTypeId4` | int | yes |
| `CookieField4` | nvarchar(100) | yes |
| `CookieFieldTypeId5` | int | yes |
| `CookieField5` | nvarchar(100) | yes |
| `CookieUserIP` | varchar(15) | no |
| `CookieUserId` | int | no |
| `CookieUserRoleId` | int | no |
| `CookieDeadlineTotal` | int | yes |
| `CookieDeadlineTotalTime` | datetime | yes |
| `CookieDeadlineTotalTimeSolar` | char(16) | yes |
| `CookieDeadline` | int | yes |
| `CookieDeadlineCoef` | float | yes |
| `CookieDeadlineTime` | datetime | yes |
| `CookieDeadlineTimeSolar` | char(16) | yes |
| `CookieIsCritical` | bit | no |
| `CookieTimeRequired` | int | yes |
| `CookieAttachmentsCount` | smallint | no |
| `CookiePersuitsCount` | smallint | no |
| `CookieHintsCount` | smallint | no |
| `CookieLinkedCount` | smallint | no |
| `CookieTypeId` | int | no |
| `CookieStatusId` | int | yes |
| `CookieCauseId` | int | yes |
| `CookieChannelId` | int | no |
| `SubjectId` | int | no |
| `SubjectGroupId` | int | no |
| `SubjectPriorityId` | smallint | no |
| `SubjectNatureId` | smallint | yes |
| `SubjectClassId` | int | no |
| `FlowId` | int | yes |
| `ZoneId` | smallint | yes |
| `DepartmentId` | int | yes |
| `UserId` | int | yes |
| `EventId` | bigint | yes |
| `ReferringCookieId` | bigint | yes |
| `AgentPersonnelId` | int | yes |
| `ExecuterPersonnelId` | int | yes |
| `CookieCancelTime` | datetime | yes |
| `CookieCancelTimeSolar` | nvarchar(32) | yes |
| `CallerId` | nvarchar(32) | yes |
| `RecordedFileName` | nvarchar(1000) | yes |
| `RecordedFilePath` | nvarchar(1000) | yes |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `CookieIdDuplicate` | bigint | yes |
| `CookieDiscontentCount` | int | yes |
| `CookieDiscontentTime` | datetime | yes |
| `CookieDiscontentTimeSolar` | char(16) | yes |
| `CookieVisitedUserId` | int | yes |
| `CookieVisitedTime` | datetime | yes |
| `CookieVisitedTimeSolar` | char(16) | yes |
| `CookieCode` | int | yes |
| `CookieRequireTimeCorroborant` | bit | yes |
| `CookieScoreFinal` | int | yes |
| `GiftTypeId` | smallint | yes |
| `GiftId` | int | yes |
| `CookieGiftPrice` | money | yes |
| `CookieReplayCitizen` | nvarchar(2000) | yes |
| `SatisfactionScore` | float | yes |
| `CommentDisAgreeCount` | int | yes |
| `AgentId` | int | yes |
| `CommentAgreeCount` | int | yes |
| `PhoneBookDepartmentId` | int | yes |
| `CookieTakeTime` | bigint | yes |
| `CookieScore` | int | no |
| `CookieRequiredDays` | int | yes |
| `IsSentSmsForLocation` | bit | yes |
| `IsSentSmsForAttachment` | bit | yes |
| `CookieSubmitCtznDoc` | smallint | yes |
| `CallId` | nvarchar(40) | yes |
| `CookieUID` | nvarchar(200) | yes |

### `Inform` (~193084 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `InformId` | bigint | no |
| `InformAddress` | nvarchar(1000) | yes |
| `InformAddressZiped` | nvarchar(1000) | yes |
| `InformLatitude` | float | yes |
| `InformLongitude` | float | yes |
| `InformerFirstName` | nvarchar(100) | yes |
| `InformerFirstNameZiped` | nvarchar(200) | yes |
| `InformerLastName` | nvarchar(100) | yes |
| `InformerLastNameZiped` | nvarchar(200) | yes |
| `InformerNationalCode` | nvarchar(20) | yes |
| `InformerCallerId` | nvarchar(60) | yes |
| `InformerPhone1` | nvarchar(60) | yes |
| `InformerPhone2` | nvarchar(60) | yes |
| `InformerPhone3` | nvarchar(60) | yes |
| `InformerCellPhone1` | nvarchar(60) | yes |
| `InformerCellPhone2` | nvarchar(60) | yes |
| `InformerEmail` | nvarchar(200) | yes |
| `InformerAddress` | nvarchar(600) | yes |
| `InformerAddressZiped` | nvarchar(600) | yes |
| `InformerPostalCode` | nvarchar(60) | yes |
| `InformerBirthYear` | nvarchar(8) | yes |
| `InformerRegionId` | int | yes |
| `InformerAreaId` | int | yes |
| `InformerDistrinctId` | int | yes |
| `InformerGenderId` | smallint | yes |
| `InformerEducationTypeId` | smallint | yes |
| `InformerAgentId` | int | yes |
| `InformerAgentGroupId` | smallint | yes |
| `InformerZiped` | nvarchar(8000) | yes |
| `SegmentId` | int | yes |
| `RegionId` | int | yes |
| `AreaId` | int | yes |
| `DistrinctId` | int | yes |
| `CookieId` | bigint | no |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `InformLatitudeDevice` | float | yes |
| `InformLongitudeDevice` | float | yes |
| `InformCode` | int | yes |
| `DepartmentIdPlaceOccur` | int | yes |
| `GetterNationalCode` | nvarchar(20) | yes |
| `GetterDesc` | nvarchar(1000) | yes |
| `CenterCategoryId` | int | yes |
| `CenterId` | int | yes |
| `CenterDesc` | nvarchar(1000) | yes |
| `InformFeedbackId` | varchar(500) | yes |
| `InformerPosition` | nvarchar(500) | yes |
| `ReferalId` | int | yes |
| `InformerSocialClassId` | smallint | yes |
| `InformMapAddress` | nvarchar(600) | yes |

### `CookieFlow` (~632835 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `CookieFlowId` | bigint | no |
| `CookieId` | bigint | no |
| `CookieFlowYear` | int | no |
| `CookieFlowNo` | bigint | no |
| `CookieFlowTrackingNo` | bigint | no |
| `CookieFlowIsCritical` | bit | no |
| `CookieFlowCaption` | nvarchar(500) | no |
| `CookieFlowCaptionZiped` | nvarchar(500) | no |
| `CookieFlowText` | nvarchar(8000) | yes |
| `CookieFlowTextZiped` | nvarchar(8000) | yes |
| `CookieFlowDesc` | nvarchar(8000) | yes |
| `CookieFlowDescZiped` | nvarchar(8000) | yes |
| `CookieFlowTime` | datetime | no |
| `CookieFlowTimeSolar` | char(16) | no |
| `CookieFlowFinishTime` | datetime | yes |
| `CookieFlowFinishTimeSolar` | char(16) | yes |
| `CookieFlowActionTime` | datetime | yes |
| `CookieFlowActionTimeSolar` | char(16) | yes |
| `CookieFlowPreActionTime` | datetime | yes |
| `CookieFlowPreActionTimeSolar` | char(16) | yes |
| `CookieFlowRequiredTime` | datetime | yes |
| `CookieFlowRequiredTimeSolar` | char(16) | yes |
| `CookieFlowAttribute1` | nvarchar(200) | yes |
| `CookieFlowAttribute2` | nvarchar(200) | yes |
| `CookieFlowAttribute3` | nvarchar(200) | yes |
| `CookieFlowAttribute4` | nvarchar(200) | yes |
| `CookieFlowAttribute5` | nvarchar(200) | yes |
| `CookieFlowIntAttribute1` | int | yes |
| `CookieFlowIntAttribute2` | int | yes |
| `CookieFlowIntAttribute3` | int | yes |
| `CookieFlowIntAttribute4` | int | yes |
| `CookieFlowIntAttribute5` | int | yes |
| `CookieFlowFieldTypeId1` | int | yes |
| `CookieFlowField1` | nvarchar(100) | yes |
| `CookieFlowFieldTypeId2` | int | yes |
| `CookieFlowField2` | nvarchar(100) | yes |
| `CookieFlowFieldTypeId3` | int | yes |
| `CookieFlowField3` | nvarchar(100) | yes |
| `CookieFlowFieldTypeId4` | int | yes |
| `CookieFlowField4` | nvarchar(100) | yes |
| `CookieFlowFieldTypeId5` | int | yes |
| `CookieFlowField5` | nvarchar(100) | yes |
| `CookieFlowDuration` | int | yes |
| `CookieFlowAttachmentsCount` | smallint | no |
| `CookieFlowPersuitsCount` | smallint | no |
| `CookieFlowHintsCount` | smallint | no |
| `CookieFlowLinkedCount` | smallint | no |
| `CookieFlowUserIP` | varchar(15) | no |
| `CookieFlowUserId` | int | no |
| `CookieFlowUserRoleId` | int | no |
| `CookieFlowDeadlineTotal` | int | yes |
| `CookieFlowDeadlineTotalTime` | datetime | yes |
| `CookieFlowDeadlineTotalTimeSolar` | char(16) | yes |
| `CookieFlowDeadlineCoef` | float | yes |
| `CookieFlowDeadline` | int | yes |
| `CookieFlowDeadlineTime` | datetime | yes |
| `CookieFlowDeadlineTimeSolar` | char(16) | yes |
| `CookieTypeId` | int | no |
| `CookieStatusId` | int | yes |
| `CookieCauseId` | int | yes |
| `CookieChannelId` | int | no |
| `PreCookieStatusId` | int | yes |
| `PreCookieFlowId` | bigint | yes |
| `SubjectId` | int | no |
| `SubjectGroupId` | int | no |
| `SubjectPriorityId` | smallint | no |
| `SubjectNatureId` | smallint | yes |
| `SubjectClassId` | int | no |
| `FlowId` | int | yes |
| `ZoneId` | smallint | no |
| `DepartmentId` | int | yes |
| `UserId` | int | yes |
| `AgentPersonnelId` | int | yes |
| `ExecuterPersonnelId` | int | yes |
| `CookieFlowCancelTime` | datetime | yes |
| `CookieFlowCancelTimeSolar` | nvarchar(32) | yes |
| `CallerId` | nvarchar(32) | yes |
| `RecordedFileName` | nvarchar(1000) | yes |
| `RecordedFilePath` | nvarchar(1000) | yes |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `CookieIdDuplicate` | bigint | yes |
| `CookieFlowDiscontentCount` | int | yes |
| `CookieFlowDiscontentTime` | datetime | yes |
| `CookieFlowDiscontentTimeSolar` | char(16) | yes |
| `CookieFlowVisitedUserId` | int | yes |
| `CookieFlowVisitedTime` | datetime | yes |
| `CookieFlowVisitedTimeSolar` | char(16) | yes |
| `CookieFlowCode` | int | yes |
| `CookieflowRequireTimeCorroborant` | bit | yes |
| `CookieFlowTakeTime` | bigint | yes |
| `CookieFlowDelayTime` | bigint | yes |
| `CookieFlowScore` | int | yes |
| `ReferToUserId` | int | yes |
| `LatitudeDevice` | float | yes |
| `LongitudeDevice` | float | yes |
| `SatisfactionScore` | float | yes |
| `CookieTakeTime` | bigint | yes |
| `UserPosition` | nvarchar(500) | yes |
| `ShahrRequestReturnValue` | varchar(20) | yes |
| `CookieScore` | int | no |
| `MissionEquipId` | int | yes |
| `CookieFlowReplyCitizen` | nvarchar(2000) | yes |
| `CookieFlowRequiredDays` | int | yes |
| `CallId` | nvarchar(40) | yes |
| `CookieFlowVisitedUserPosition` | nvarchar(500) | yes |
| `ReferToUserPosition` | nvarchar(500) | yes |

### `Cartable` (~30122 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `CartableId` | bigint | no |
| `CookieFlowId` | bigint | no |
| `CookieId` | bigint | no |
| `CartableYear` | int | no |
| `CartableNo` | bigint | no |
| `CartableTrackingNo` | bigint | no |
| `CartableIsCritical` | bit | no |
| `CartableCaption` | nvarchar(500) | no |
| `CartableCaptionZiped` | nvarchar(500) | no |
| `CartableText` | nvarchar(8000) | yes |
| `CartableTextZiped` | nvarchar(8000) | yes |
| `CartableDesc` | nvarchar(8000) | yes |
| `CartableDescZiped` | nvarchar(8000) | yes |
| `CartableTime` | datetime | no |
| `CartableTimeSolar` | char(16) | no |
| `CartableFinishTime` | datetime | yes |
| `CartableFinishTimeSolar` | char(16) | yes |
| `CartableActionTime` | datetime | yes |
| `CartableActionTimeSolar` | char(16) | yes |
| `CartablePreActionTime` | datetime | yes |
| `CartablePreActionTimeSolar` | char(16) | yes |
| `CartableRequiredTime` | datetime | yes |
| `CartableRequiredTimeSolar` | char(16) | yes |
| `CartableAttribute1` | nvarchar(600) | yes |
| `CartableAttribute2` | nvarchar(200) | yes |
| `CartableAttribute3` | nvarchar(200) | yes |
| `CartableAttribute4` | nvarchar(200) | yes |
| `CartableAttribute5` | nvarchar(200) | yes |
| `CartableIntAttribute1` | int | yes |
| `CartableIntAttribute2` | int | yes |
| `CartableIntAttribute3` | int | yes |
| `CartableIntAttribute4` | int | yes |
| `CartableIntAttribute5` | int | yes |
| `CartableFieldTypeId1` | int | yes |
| `CartableField1` | nvarchar(100) | yes |
| `CartableFieldTypeId2` | int | yes |
| `CartableField2` | nvarchar(100) | yes |
| `CartableFieldTypeId3` | int | yes |
| `CartableField3` | nvarchar(100) | yes |
| `CartableFieldTypeId4` | int | yes |
| `CartableField4` | nvarchar(100) | yes |
| `CartableFieldTypeId5` | int | yes |
| `CartableField5` | nvarchar(100) | yes |
| `CartableDuration` | int | yes |
| `CartableAttachmentsCount` | smallint | no |
| `CartablePersuitsCount` | smallint | no |
| `CartableHintsCount` | smallint | no |
| `CartableLinkedCount` | smallint | no |
| `CartableUserIP` | varchar(15) | no |
| `CartableUserId` | int | no |
| `CartableUserRoleId` | int | no |
| `CartableDeadlineTotal` | int | yes |
| `CartableDeadlineTotalTime` | datetime | yes |
| `CartableDeadlineTotalTimeSolar` | char(16) | yes |
| `CartableDeadlineCoef` | float | yes |
| `CartableDeadline` | int | yes |
| `CartableDeadlineTime` | datetime | yes |
| `CartableDeadlineTimeSolar` | char(16) | yes |
| `CookieTypeId` | int | no |
| `CookieStatusId` | int | yes |
| `CookieCauseId` | int | yes |
| `CookieChannelId` | int | no |
| `PreCookieStatusId` | int | yes |
| `PreCookieFlowId` | bigint | yes |
| `SubjectId` | int | no |
| `SubjectGroupId` | int | no |
| `SubjectPriorityId` | smallint | no |
| `SubjectNatureId` | smallint | yes |
| `SubjectClassId` | int | no |
| `FlowId` | int | no |
| `ZoneId` | smallint | no |
| `DepartmentId` | int | yes |
| `UserId` | int | yes |
| `AgentPersonnelId` | int | yes |
| `ExecuterPersonnelId` | int | yes |
| `CartableCancelTime` | datetime | yes |
| `CartableCancelTimeSolar` | nvarchar(32) | yes |
| `CallerId` | nvarchar(32) | yes |
| `RecordedFileName` | nvarchar(1000) | yes |
| `RecordedFilePath` | nvarchar(1000) | yes |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `CookieIdDuplicate` | bigint | yes |
| `CartableDiscontentCount` | int | yes |
| `CartableDiscontentTime` | datetime | yes |
| `CartableDiscontentTimeSolar` | char(16) | yes |
| `CartableVisitedUserId` | int | yes |
| `CartableVisitedTime` | datetime | yes |
| `CartableVisitedTimeSolar` | char(16) | yes |
| `CartableCode` | int | yes |
| `CartableRequireTimeCorroborant` | bit | yes |
| `ReferToUserId` | int | yes |
| `CommentDisAgreeCount` | int | yes |
| `CommentAgreeCount` | int | yes |
| `CartableScore` | int | no |
| `CartableRequiredDays` | int | yes |
| `CartableSubmitCtznDoc` | smallint | yes |
| `CallId` | nvarchar(40) | yes |

### `CookiePursuit` (~150280 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `CookiePursuitId` | int | no |
| `CookiePursuitComment` | nvarchar(1800) | no |
| `CookiePursuitTime` | datetime | no |
| `CookiePursuitTimeSolar` | char(16) | no |
| `RoleId` | int | no |
| `UserId` | int | no |
| `ViaCookieId` | bigint | yes |
| `CookieId` | bigint | no |
| `CookieFlowId` | bigint | no |
| `CookieChannelId` | int | yes |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `CookiePursuitReply` | nvarchar | yes |
| `CookiePursuitReplyUserId` | int | yes |
| `CookiePursuitReplyRoleId` | int | yes |
| `CookiePursuitReplyTime` | datetime | yes |

### `Subject` (~420 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `SubjectId` | int | no |
| `SubjectCode` | nvarchar(100) | yes |
| `SubjectName` | nvarchar(1000) | no |
| `SubjectZiped` | nvarchar(1600) | yes |
| `SubjectEventRadius` | float | yes |
| `SubjectEventTimeRadius` | float | yes |
| `SubjectIsRelatedBySegment` | bit | no |
| `SubjectIsRelatedByRegion` | bit | no |
| `SubjectIsRelatedByArea` | bit | no |
| `SubjectIsRelatedByDepartment` | bit | no |
| `SubjectGroupId` | int | no |
| `SubjectNatureId` | smallint | no |
| `ZoneId` | smallint | no |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `SubjectSummaryName` | nvarchar(500) | yes |
| `SubjectIsInternet` | bit | no |
| `ValidFrom` | datetime2 | no |
| `ValidTo` | datetime2 | no |
| `IsDisableDuplicate` | bit | no |
| `CookieTypeId` | int | yes |
| `SubjectIsRelatedByGetter` | bit | no |
| `SubjectIsRelatedByCenter` | bit | no |
| `SubjectEventDetectionBy` | smallint | no |
| `SubjectEventSmsExceed` | int | yes |

### `SubjectGroup` (~93 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `SubjectGroupId` | int | no |
| `SubjectGroupName` | nvarchar(400) | yes |
| `SubjectGroupSummaryName` | nvarchar(400) | yes |
| `SubjectGroupZiped` | nvarchar(400) | yes |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `SubjectGroupCode` | nvarchar(100) | yes |
| `ValidFrom` | datetime2 | no |
| `ValidTo` | datetime2 | no |
| `CookieTypeId` | int | yes |

### `SubjectNature` (~30 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `SubjectNatureId` | smallint | no |
| `SubjectNatureName` | nvarchar(200) | yes |
| `SubjectNatureSummaryName` | nvarchar(200) | yes |
| `SubjectNatureZiped` | nvarchar(200) | yes |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `ValidFrom` | datetime2 | no |
| `ValidTo` | datetime2 | no |
| `CookieTypeId` | int | yes |

### `SubjectClass` (~4 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `SubjectClassId` | int | no |
| `SubjectClassName` | nvarchar(100) | no |
| `SubjectClassZiped` | nvarchar(400) | no |
| `SubjectClassSummaryName` | nvarchar(100) | no |
| `SubjectClassIsCookieTypeDefault` | bit | no |
| `CookieTypeId` | int | no |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `ValidFrom` | datetime2 | no |
| `ValidTo` | datetime2 | no |

### `SubjectPriority` (~3 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `SubjectPriorityId` | smallint | no |
| `SubjectPriorityName` | nvarchar(120) | no |
| `SubjectPrioritySummaryName` | nvarchar(100) | no |
| `SubjectPriorityZiped` | nvarchar(200) | no |
| `CookieTypeId` | int | no |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `ValidFrom` | datetime2 | no |
| `ValidTo` | datetime2 | no |
| `SubjectPriorityIndex` | int | yes |

### `Zone` (~8 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `ZoneId` | smallint | no |
| `ZoneName` | nvarchar(200) | yes |
| `ZoneSummaryName` | nvarchar(200) | yes |
| `ZoneZiped` | nvarchar(200) | yes |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `ValidFrom` | datetime2 | no |
| `ValidTo` | datetime2 | no |
| `CookieTypeId` | int | yes |

### `Department` (~1710 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `DepartmentId` | int | no |
| `DepartmentCode` | nvarchar(20) | no |
| `DepartmentName` | nvarchar(600) | yes |
| `RegionId` | int | yes |
| `DepartmentZiped` | nvarchar(600) | yes |
| `DepartmentAddress` | nvarchar(800) | yes |
| `DepartmentPostalCode` | nvarchar(20) | yes |
| `DepartmentPhone1` | nvarchar(40) | yes |
| `DepartmentPhone2` | nvarchar(40) | yes |
| `DepartmentPhone3` | nvarchar(40) | yes |
| `DepartmentFax` | nvarchar(40) | yes |
| `DepartmentRank` | int | yes |
| `DepartmentIsActive` | bit | no |
| `DepartmentTypeId` | smallint | no |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `AreaId` | int | yes |
| `FlowId` | int | yes |
| `DepartmentIsOutOfRange` | bit | no |
| `DepartmentOrPlaceOccur` | smallint | yes |
| `ValidFrom` | datetime2 | no |
| `ValidTo` | datetime2 | no |
| `Latitude` | float | yes |
| `Longitude` | float | yes |
| `AgentId` | int | yes |
| `DepartmentDesc` | nvarchar | yes |

### `DepartmentChart` (~1710 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `DepartmentChartId` | int | no |
| `DepartmentId` | int | no |
| `ParentDepartmentId` | int | yes |
| `WorkspaceId` | int | yes |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `ValidFrom` | datetime2 | no |
| `ValidTo` | datetime2 | no |

### `Region` (~33 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `RegionId` | int | no |
| `RegionName` | nvarchar(200) | no |
| `RegionSummaryName` | nvarchar(100) | no |
| `RegionZiped` | nvarchar(200) | no |
| `RegionPopulation` | bigint | yes |
| `RegionExtent` | bigint | yes |
| `DepartmentId` | int | yes |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `RegionIsActive` | bit | no |
| `ValidFrom` | datetime2 | no |
| `ValidTo` | datetime2 | no |
| `IsUnknown` | bit | no |
| `GisCode` | nvarchar(20) | yes |
| `MobileGISDocumentId` | int | yes |

### `Area` (~477 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `AreaId` | int | no |
| `AreaCode` | int | no |
| `AreaSummaryName` | nvarchar(100) | no |
| `AreaName` | nvarchar(200) | no |
| `AreaZiped` | nvarchar(200) | no |
| `AreaPopulation` | bigint | yes |
| `AreaExtent` | bigint | yes |
| `RegionId` | int | no |
| `SegmentId` | int | yes |
| `DepartmentId` | int | yes |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `ValidFrom` | datetime2 | no |
| `ValidTo` | datetime2 | no |
| `GisCode` | nvarchar(20) | yes |
| `AreaLatitude` | float | yes |
| `AreaLongitude` | float | yes |

### `CookieChannel` (~10 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `CookieChannelId` | int | no |
| `CookieChannelName` | nvarchar(100) | no |
| `CookieChannelEnglishName` | nvarchar(100) | yes |
| `CookieChannelZiped` | nvarchar(100) | no |
| `CookieChannelIsDefault` | bit | no |
| `CookieChannelIsAutomatic` | bit | no |
| `CookieTypeId` | int | no |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `ValidFrom` | datetime2 | no |
| `ValidTo` | datetime2 | no |

### `CookieStatus` (~30 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `CookieStatusId` | int | no |
| `CookieStatusName` | nvarchar(140) | no |
| `CookieStatusSummaryName` | nvarchar(140) | no |
| `CookieStatusZiped` | nvarchar(200) | no |
| `CookieStatusIsActive` | bit | no |
| `CookieStatusIsUrbanRelated` | bit | no |
| `CookieStatusCitizenDescription` | nvarchar | yes |
| `CookieStatusValue` | int | yes |
| `CookieStatusHasDepartment` | bit | no |
| `CookieStatusHasMessageCode` | bit | yes |
| `CookieStatusHasTimer` | bit | yes |
| `CookieStatusHasAgentCode` | bit | yes |
| `CookieStatusIsRefer` | bit | no |
| `CookieStatusIsRefund` | bit | no |
| `CookieStatusIsEditable` | bit | yes |
| `CookieStatusCleanStack` | bit | no |
| `CookieStatusGroupId` | int | no |
| `CookieTypeId` | int | no |
| `CookieStatusVoice` | nvarchar(100) | yes |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `ValidFrom` | datetime2 | no |
| `ValidTo` | datetime2 | no |
| `CookieStatusNameCitizen` | nvarchar(140) | yes |
| `CookieStatusFinished` | bit | yes |
| `IsShowAttachmentStep` | bit | no |
| `IsMandatoryAttachmentStep` | bit | no |
| `IsNotEffectOnTimeBasedReports` | bit | no |
| `CookieStatusAttachmentCount` | int | yes |

### `CookieType` (~5 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `CookieTypeId` | int | no |
| `CookieTypeName` | nvarchar(100) | no |
| `CookieTypeTableName` | nvarchar(100) | no |
| `CookieTypeZiped` | nvarchar(100) | no |
| `CookieTypeFlowBased` | bit | no |
| `WorkspaceId` | int | no |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `ValidFrom` | datetime2 | no |
| `ValidTo` | datetime2 | no |

### `CookieCause` (~1 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `CookieCauseId` | int | no |
| `CookieCauseName` | nvarchar(180) | no |
| `CookieCauseZiped` | nvarchar(200) | no |
| `CookieTypeId` | int | no |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `ValidFrom` | datetime2 | no |
| `ValidTo` | datetime2 | no |

### `Flow` (~4 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `FlowId` | int | no |
| `FlowName` | nvarchar(160) | no |
| `FlowZiped` | nvarchar(160) | no |
| `FlowIsActive` | bit | no |
| `FlowIsDefault` | bit | no |
| `DepartmentTypeId` | smallint | yes |
| `CookieTypeId` | int | no |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `ValidFrom` | datetime2 | no |
| `ValidTo` | datetime2 | no |

### `FlowNode` (~109 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `FlowNodeId` | int | no |
| `FlowNodeDefaultDesc` | nvarchar(1000) | yes |
| `FlowNodeZiped` | nvarchar(1000) | yes |
| `FlowNodeIsDelayed` | bit | no |
| `FlowNodeActionTimeShow` | bit | no |
| `FlowNodeActionTimeIsMandatory` | bit | no |
| `FlowNodeCauseShow` | bit | no |
| `FlowNodeCauseIsMandatory` | bit | no |
| `FlowNodeInformBySendSMS` | bit | no |
| `FlowNodeSMSEditable` | bit | no |
| `FlowNodeIsPrintable` | bit | no |
| `FlowNodeDepartmentIsMandatory` | bit | no |
| `FlowNodeRegionIsMandatory` | bit | no |
| `FlowNodeAreaIsMandatory` | bit | no |
| `FlowNodeCanChangeFlow` | bit | no |
| `FlowNodeRequireResponsible` | bit | no |
| `FlowNodeDeadlineCoef` | float | no |
| `FlowNodeInformationText` | nvarchar(2000) | yes |
| `CookieStatusId` | int | yes |
| `NextCookieStatusId` | int | no |
| `RoleId` | int | no |
| `FlowId` | int | no |
| `CookieHintTypeId` | int | yes |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `FlowNodeIsDuplicateCartable` | bit | no |
| `CookieStatusDesc` | nvarchar(2000) | yes |
| `CookieStatusFileName` | nvarchar(200) | yes |
| `FlowNodeIsDiscontent` | bit | no |
| `FlowNodeNextStatusIsDefault` | bit | no |
| `FlowNodeIsSendSMSToUsers` | bit | no |
| `FlowNodeUserSMSText` | nvarchar(2000) | yes |
| `FlowNodeIsExpireRequiredTime` | bit | no |
| `FlowNodeExpireRequiredTimeIsDefault` | bit | no |
| `FlowNodeRequireTimeCorroborant` | bit | yes |
| `FlowNodeDistrictIsMandatory` | bit | no |
| `FlowNodeIsScore` | bit | no |
| `FlowNodeIsScoreFinal` | bit | no |
| `FlowNodeIsGift` | bit | no |
| `FlowNodeIsReplyCitizen` | bit | no |
| `FlowNodeInformerIsEditable` | bit | no |
| `FlowNodeRequireVisitedAttachment` | bit | no |
| `FlowNodeIsAutomatic` | bit | no |
| `ValidFrom` | datetime2 | no |
| `ValidTo` | datetime2 | no |
| `FlowNodeIsCheckEventRadius` | bit | no |
| `FlowNodeIsSendCartableToUser` | bit | no |
| `CookieFlowDescIsMandatory` | bit | no |
| `IsInsertedAttachmentMandatory` | bit | no |
| `RepeatCountStatus` | int | yes |
| `IsGetterEditable` | bit | no |
| `IsCenterEditable` | bit | no |
| `IsFeedback` | bit | no |
| `IsNotEffectSubjectClassMemberDepartment` | bit | no |
| `IsNotChangeFlow` | bit | no |
| `FlowNodeIsRequireShahrsaziRequest` | bit | no |
| `FlowNodeScore` | int | no |
| `FlowNodeIsRequireMobileGISRequest` | bit | no |
| `FlowNodeDeadlineFixed` | int | no |
| `FlowNodeCanChangeEquip` | bit | no |
| `FlowNodeIsChangeStatusMapVisible` | bit | no |
| `FlowNodeCanChangeReferral` | bit | no |
| `FlowNodePGSBSendSms` | bit | no |
| `FlowNodeContractCorroborant` | bit | yes |
| `FlowNodeInformationDuplicateText` | nvarchar(2000) | yes |
| `FlowNodeUserSMSDuplicateText` | nvarchar(2000) | yes |
| `FlowNodeDuplicateStatusProccessing` | bit | no |
| `FlowNodeDuplicateStatusProccessed` | bit | no |

### `Agent` (~69517 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `AgentId` | int | no |
| `AgentnFirstName` | nvarchar(100) | no |
| `AgentLastName` | nvarchar(100) | no |
| `AgentNationalCode` | nvarchar(20) | yes |
| `AgentCallerId` | nvarchar(60) | yes |
| `AgentPhone1` | nvarchar(60) | yes |
| `AgentPhone2` | nvarchar(60) | yes |
| `AgentPhone3` | nvarchar(60) | yes |
| `AgentCellPhone1` | nvarchar(60) | yes |
| `AgentCellPhone2` | nvarchar(60) | yes |
| `AgentEmail` | nvarchar(200) | yes |
| `AgentAddress` | nvarchar(600) | yes |
| `AgentAddressZiped` | nvarchar(600) | yes |
| `AgentPostalCode` | nvarchar(60) | yes |
| `AgentBirthDate` | date | yes |
| `AgentBirthDateSolar` | char(10) | yes |
| `AgentPassword` | nvarchar(100) | yes |
| `AgentExpertiseFieldId` | smallint | yes |
| `AgentSocialClassId` | smallint | yes |
| `EducationTypeId` | smallint | yes |
| `GenderId` | smallint | yes |
| `RegionId` | int | yes |
| `AreaId` | int | yes |
| `DistrictId` | int | yes |
| `InsertTime` | datetime | no |
| `InsertUserId` | int | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `AgentUsername` | nvarchar(100) | yes |
| `CookieId` | bigint | yes |
| `ValidFrom` | datetime2 | no |
| `ValidTo` | datetime2 | no |
| `AgentAddressLatitude` | float | yes |
| `AgentAddressLongitude` | float | yes |
| `AgentAge` | int | yes |
| `IsValidData` | bit | no |

### `UserInfo` (~1538 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `UserId` | int | no |
| `UserName` | nvarchar(300) | no |
| `UserFirstName` | nvarchar(100) | no |
| `UserLastName` | nvarchar(100) | no |
| `UserEmail` | nvarchar(200) | yes |
| `UserMobile` | nvarchar(100) | no |
| `UserDataZiped` | nvarchar(400) | no |
| `UserPassword` | nvarchar(100) | no |
| `UserIsActive` | bit | no |
| `UserIsAdmin` | bit | no |
| `PersonnelId` | int | yes |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `UserSmsIsAvailable` | bit | no |
| `UserExpireTime` | datetime | yes |
| `UserExpireTimeSolar` | nvarchar(32) | yes |
| `UserPracticalSmsIsAvailable` | bit | yes |
| `UserIP` | varchar(15) | yes |
| `ValidFrom` | datetime2 | no |
| `ValidTo` | datetime2 | no |
| `IsBestUser` | bit | no |
| `IsChatResponder` | bit | no |
| `UserPosition` | nvarchar(500) | yes |
| `UserGroupId` | int | yes |
| `IsTwoStepVerificationEnable` | bit | no |

### `Role` (~15 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `RoleId` | int | no |
| `RoleName` | nvarchar(100) | no |
| `RoleZiped` | nvarchar(100) | no |
| `WorkspaceId` | int | no |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `RoleIsShowMobile` | bit | no |
| `ValidFrom` | datetime2 | no |
| `ValidTo` | datetime2 | no |

### `RoleMember` (~909 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `RoleMemberId` | int | no |
| `RoleId` | int | no |
| `UserId` | int | no |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `RoleMemberIsDefault` | bit | no |
| `ValidFrom` | datetime2 | no |
| `ValidTo` | datetime2 | no |
| `NotRegisterVisit` | bit | no |
| `NotFlow` | bit | no |
| `NotCreateAttachment` | bit | no |
| `NotRemoveAttachment` | bit | no |
| `UserPracticalSmsIsAvailable` | bit | no |
| `UserSmsIsAvailable` | bit | no |

### `RoleMemberAccess` (~6821 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `RoleMemberAccessId` | int | no |
| `RoleMemberId` | int | no |
| `DepartmentId` | int | yes |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `SubjectClassMemberId` | int | yes |
| `ValidFrom` | datetime2 | no |
| `ValidTo` | datetime2 | no |
| `ChangedDepartmentId` | int | yes |
| `NotRegisterVisit` | bit | no |
| `NotFlow` | bit | no |
| `NotCreateAttachment` | bit | no |
| `NotRemoveAttachment` | bit | no |
| `EquipId` | int | yes |
| `ChangedEquipId` | int | yes |
| `CookieChannelId` | int | yes |

### `Sentbox` (~208823 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `SentboxId` | int | no |
| `SentboxOwnerTable` | nvarchar(200) | no |
| `SentboxOwnerId` | bigint | no |
| `SentboxMobile` | nvarchar(100) | no |
| `SentboxText` | nvarchar(2000) | no |
| `SentboxTextZiped` | nvarchar(2000) | no |
| `SentboxCost` | int | no |
| `SentboxTime` | datetime | no |
| `SentboxTimeSolar` | nchar(38) | no |
| `SentboxIsUnicode` | bit | no |
| `MessageStatus` | nvarchar | yes |
| `MessageId` | nvarchar(100) | yes |
| `WorkspaceId` | int | no |
| `UserId` | int | no |
| `RoleId` | int | no |
| `InboxId` | bigint | yes |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `DeliveryStatus` | smallint | no |

### `Inbox` (~9736 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `InboxId` | bigint | no |
| `InboxMessageId` | int | no |
| `InboxFrom` | nvarchar(100) | no |
| `InboxTo` | nvarchar(100) | no |
| `InboxTime` | datetime | no |
| `InboxTimeSolar` | nchar(38) | no |
| `InboxBody` | nvarchar(2000) | no |
| `InboxBodyZiped` | nvarchar(2000) | no |
| `InboxCharCount` | int | no |
| `InboxIsAnswered` | bit | no |
| `InboxIsUnicode` | bit | no |
| `InboxIsChecked` | bit | no |
| `WorkspaceMemberId` | int | no |
| `WorkspaceId` | int | no |
| `SentboxId` | int | yes |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `InboxIP` | nvarchar(40) | yes |

### `CallReceived` (~81214 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `CallReceivedId` | int | no |
| `ExtentionId` | nvarchar(10) | yes |
| `CallerId` | nvarchar(32) | yes |
| `RecordedFileName` | nvarchar(1000) | yes |
| `RecordedFilePath` | nvarchar(1000) | yes |
| `InsertUserId` | int | yes |
| `InsertTime` | datetime | yes |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | yes |
| `Referenceid` | nvarchar(400) | yes |
| `CallReceivedTypeId` | tinyint | yes |

### `CallRecord` (~31974 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `CallRecordId` | bigint | no |
| `UserId` | int | no |
| `ExtentionId` | nvarchar(10) | no |
| `ReferenceId` | nvarchar(200) | yes |
| `CallerId` | nvarchar(32) | no |
| `RecordedFilePath` | nvarchar(1000) | yes |
| `PageName` | nvarchar(300) | yes |
| `CookieId` | bigint | yes |
| `CookieFlowId` | bigint | yes |
| `CookiePursuitId` | int | yes |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `CallReceivedId` | int | yes |

### `AttachmentVisite` (~75721 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `AttachmentVisiteId` | int | no |
| `CookieId` | bigint | no |
| `AttachmentId` | int | no |
| `UserId` | int | no |
| `RoleId` | int | yes |
| `CookieStatusId` | int | yes |
| `DateTimeSolarVisited` | nvarchar(32) | no |
| `DateTimeVisited` | datetime | no |
| `UserIP` | nvarchar(30) | yes |
| `AttachmentVisiteDesc` | nvarchar(100) | yes |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |

### `FAQ` (~5 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `id` | int | no |
| `index` | int | yes |
| `question` | nvarchar | yes |
| `answer` | nvarchar | yes |

### `Workspace` (~2 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `WorkspaceId` | int | no |
| `WorkspaceName` | nvarchar(600) | no |
| `WorkspaceSummaryName` | nvarchar(600) | no |
| `WorkspaceZiped` | nvarchar(600) | yes |
| `WorkspaceUsername` | nvarchar(600) | yes |
| `WorkspacePassword` | nvarchar(600) | yes |
| `WorkspaceCompany` | nvarchar(600) | yes |
| `WorkspaceUrl` | nvarchar(600) | yes |
| `WorkspaceNumber` | nvarchar(600) | yes |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |
| `UpdateUserId` | int | yes |
| `UpdateTime` | datetime | yes |
| `ChangeTime` | datetime | no |
| `ValidFrom` | datetime2 | no |
| `ValidTo` | datetime2 | no |
| `ApiToken` | nvarchar(600) | yes |
| `ApiUrl` | nvarchar(600) | yes |
| `AndroidAppId` | nvarchar(600) | yes |
| `NotificationCitizenAppId` | nvarchar(1000) | yes |
| `WorkspaceKey` | nvarchar(600) | yes |
| `WorkspaceWhitelist` | nvarchar(600) | yes |

### `TerminalStatus` (~29 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `TerminalId` | int | no |
| `TerminalName` | nvarchar(300) | no |
| `TerminalTypeId` | int | no |
| `CookieStatusId` | int | no |

### `FeedbackStatus` (~3 rows)

| Column | Type | Nullable |
|--------|------|:--------:|
| `Id` | int | no |
| `RowNumber` | smallint | no |
| `CookieTypeId` | int | no |
| `RoleId` | int | no |
| `CookieStatusId` | int | no |
| `InsertUserId` | int | no |
| `InsertTime` | datetime | no |

## Empty tables (81)

`AgentExpertiseField`, `AgentExpertiseFieldLog`, `AgentGift`, `AgentGiftLog`, `AgentGiftType`, `AgentGiftTypeLog`, `AgentGrade`, `AgentGradeLog`, `AgentGradeType`, `AgentGradeTypeLog`, `AgentGroupLog`, `AgentSocialClass`, `AgentSocialClassLog`, `AgentStatusLog`, `AppVersion`, `BuildingStep`, `ChatMessage`, `ChatRoom`, `ChatUser`, `CheckList`, `CheckListFlowNode`, `ChkAnswer`, `ChkGroupQuestion`, `ChkQuestion`, `ChkRecordedAnswer`, `ChkRecordedAnswerIndex`, `ContractorContract`, `ContractorContractDepartment`, `CookieCauseLog`, `CookieComment`, `CookieCommentDisAgree`, `CookieFieldType`, `CookieHintLog`, `CookieHintTypeLog`, `CookieShare`, `CookieStatusAttachmentStep`, `CookieSubjectChild`, `CookieUserNotification`, `DefaultUserSms`, `Dictionary`, `District`, `DistrictLog`, `Equip`, `EquipMember`, `Executer`, `ExecuterLog`, `ExecuterType`, `ExecuterTypeLog`, `FlowNodeCause`, `Gift`, `GiftLog`, `GiftType`, `GiftTypeLog`, `JobLog`, `MaritalStatusLog`, `MayorMeeting`, `MeetingMember`, `Mission`, `MissionLog`, `MobileGISRequests`, `NotificationSentbox`, `Personnel`, `PersonnelLog`, `PursuitTemplate`, `Referal`, `Reminder`, `ReportResult`, `RoleStatusReports`, `Segment`, `ShiftType`, `StatusMessage`, `SubjectChild`, `SubjectClassMemberReference`, `SubjectIndex`, `SubjectReference`, `SubReport`, `TotalSystemMenuLog`, `TrackUserApp`, `UserInfoGroup`, `Vehicle`, `VehicleType`

## Agent notes

1. Primary grain: `Cookie` (~193k). Time fields: `CookieTime`, `CookieFinishTime`.
2. Taxonomy: `SubjectClass` / `SubjectNature` / `SubjectGroup` / `Subject` / `Zone`.
3. Geo via `Inform.RegionId` (filled), `AreaId` (~87%); `District`/`Segment` empty.
4. Citizen reply text: `CookieFlow.CookieFlowReplyCitizen` (~6.3% of Cookies).
5. `*DeadlineTime` columns empty → true SLA not feasible.
6. Empty modules: Gift*, Personnel, Mission*, CheckList*, Chat*, Referal, Reminder, Dictionary, CookieFieldType, …
7. Attachment file DB not accessible with current login; `AttachmentVisite` is visits only.
8. PII in Inform/Agent/texts — aggregates OK; mask drill-down.
9. Many `*Log` tables are audit/telemetry, not case facts.
