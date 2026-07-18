---
title: 'Authenticate your sending domain'
description: 'Add SPF, DKIM, and DMARC so Maildrill can send on your behalf with strong inbox placement.'
pubDate: 2026-03-01
author: 'Marcus Reed'
category: 'Deliverability'
readingMinutes: 8
series: 'Deliverability setup'
draft: false
---

Domain authentication is the foundation of inbox placement. Without it, even great content struggles.

## Add DNS records

In Settings → Domains, copy the SPF, DKIM, and DMARC records Maildrill generates. Publish them at your DNS provider, then return to verify.

## Verify before send

Green checks mean the domain is ready. Do not schedule large campaigns while any record is pending.

## Monitor DMARC

Start with `p=none`, review reports, then tighten to quarantine or reject once alignment looks healthy.
