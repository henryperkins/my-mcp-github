---
title: "Routes"
source: "https://developers.cloudflare.com/workers/configuration/routing/routes/"
author:
  - "[[Cloudflare Docs]]"
published: 2025-04-02
created: 2025-08-09
description: "Routes allow users to map a URL pattern to a Worker. When a request comes in to the Cloudflare network that matches the specified URL pattern, your Worker will execute on that route."
tags:
  - "clippings"
---
[Skip to content](https://developers.cloudflare.com/workers/configuration/routing/routes/#_top)

## Background

Routes allow users to map a URL pattern to a Worker. When a request comes in to the Cloudflare network that matches the specified URL pattern, your Worker will execute on that route.

Routes are a set of rules that evaluate against a request's URL. Routes are recommended for you if you have a designated application server you always need to communicate with. Calling `fetch()` on the incoming `Request` object will trigger a subrequest to your application server, as defined in the **DNS** settings of your Cloudflare zone.

Routes add Workers functionality to your existing proxied hostnames, in front of your application server. These allow your Workers to act as a proxy and perform any necessary work before reaching out to an application server behind Cloudflare.

![Routes work with your applications defined in Cloudflare DNS](https://developers.cloudflare.com/_astro/routes-diagram.CfGSi1RG_32rsQ.webp)

Routes can `fetch()` Custom Domains and take precedence if configured on the same hostname. If you would like to run a logging Worker in front of your application, for example, you can create a Custom Domain on your application Worker for `app.example.com`, and create a Route for your logging Worker at `app.example.com/*`. Calling `fetch()` will invoke the application Worker on your Custom Domain. Note that Routes cannot be the target of a same-zone `fetch()` call.

To add a route, you must have:

1. An [active Cloudflare zone](https://developers.cloudflare.com/dns/zone-setups/).
2. A Worker to invoke.
3. A DNS record set up for the [domain](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-zone-apex/) or [subdomain](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-subdomain/) proxied by Cloudflare (also known as orange-clouded) you would like to route to.

If your Worker is not your application's origin, follow the instructions below to set up a route.

Before you set up a route, make sure you have a DNS record set up for the [domain](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-zone-apex/) or [subdomain](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-subdomain/) you would like to route to.

To set up a route in the dashboard:

1. Log in to the [Cloudflare dashboard ↗](https://dash.cloudflare.com/) and select your account.
2. Go to **Workers & Pages** and in **Overview**, select your Worker.
3. Go to **Settings** > **Domains & Routes** > **Add** > **Route**.
4. Select the zone and enter the route pattern.
5. Select **Add route**.

Before you set up a route, make sure you have a DNS record set up for the [domain](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-zone-apex/) or [subdomain](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-subdomain/) you would like to route to.

To configure a route using your [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/), refer to the following example.

- [wrangler.jsonc](https://developers.cloudflare.com/workers/configuration/routing/routes/#tab-panel-3652)
- [wrangler.toml](https://developers.cloudflare.com/workers/configuration/routing/routes/#tab-panel-3653)

```jsonc
{
  "routes": [
    {
      "pattern": "subdomain.example.com/*",
      "zone_name": "example.com"
    },
    {
      "pattern": "subdomain.example.com/*",
      "zone_id": "<YOUR_ZONE_ID>"
    }
  ]
}
```

Add the `zone_name` or `zone_id` option after each route. The `zone_name` and `zone_id` options are interchangeable. If using `zone_id`, find your zone ID by logging in to the [Cloudflare dashboard ↗](https://dash.cloudflare.com/) > select your account > select your website > find the **Zone ID** in the lefthand side of **Overview**.

To add multiple routes:

- [wrangler.jsonc](https://developers.cloudflare.com/workers/configuration/routing/routes/#tab-panel-3654)
- [wrangler.toml](https://developers.cloudflare.com/workers/configuration/routing/routes/#tab-panel-3655)

```jsonc
{
  "routes": [
    {
      "pattern": "subdomain.example.com/*",
      "zone_name": "example.com"
    },
    {
      "pattern": "subdomain-two.example.com/example",
      "zone_id": "<YOUR_ZONE_ID>"
    }
  ]
}
```

## Matching behavior

Route patterns look like this:

```txt
https://*.example.com/images/*
```

This pattern would match all HTTPS requests destined for a subhost of example.com and whose paths are prefixed by `/images/`.

A pattern to match all requests looks like this:

```txt
*example.com/*
```

While they look similar to a [regex ↗](https://en.wikipedia.org/wiki/Regular_expression) pattern, route patterns follow specific rules:

- The only supported operator is the wildcard (`*`), which matches zero or more of any character.
- Route patterns may not contain infix wildcards or query parameters. For example, neither `example.com/*.jpg` nor `example.com/?foo=*` are valid route patterns.
- When more than one route pattern could match a request URL, the most specific route pattern wins. For example, the pattern `www.example.com/*` would take precedence over `*.example.com/*` when matching a request for `https://www.example.com/`. The pattern `example.com/hello/*` would take precedence over `example.com/*` when matching a request for `example.com/hello/world`.
- Route pattern matching considers the entire request URL, including the query parameter string. Since route patterns may not contain query parameters, the only way to have a route pattern match URLs with query parameters is to terminate it with a wildcard, `*`.
- The path component of route patterns is case sensitive, for example, `example.com/Images/*` and `example.com/images/*` are two distinct routes.
- For routes created before October 15th, 2023, the host component of route patterns is case sensitive, for example, `example.com/*` and `Example.com/*` are two distinct routes.
- For routes created on or after October 15th, 2023, the host component of route patterns is not case sensitive, for example, `example.com/*` and `Example.com/*` are equivalent routes.

A route can be specified without being associated with a Worker. This will act to negate any less specific patterns. For example, consider this pair of route patterns, one with a Workers script and one without:

```txt
*example.com/images/cat.png -> <no script>
*example.com/images/*       -> worker-script
```

In this example, all requests destined for example.com and whose paths are prefixed by `/images/` would be routed to `worker-script`, *except* for `/images/cat.png`, which would bypass Workers completely. Requests with a path of `/images/cat.png?foo=bar` would be routed to `worker-script`, due to the presence of the query string.

## Validity

The following set of rules govern route pattern validity.

If your zone is `example.com`, then the simplest possible route pattern you can have is `example.com`, which would match `http://example.com/` and `https://example.com/`, and nothing else. As with a URL, there is an implied path of `/` if you do not specify one.

For example, `https://example.com/?anything` is not a valid route pattern.

If you omit a scheme in your route pattern, it will match both `http://` and `https://` URLs. If you include `http://` or `https://`, it will only match HTTP or HTTPS requests, respectively.

- `https://*.example.com/` matches `https://www.example.com/` but not `http://www.example.com/`.
- `*.example.com/` matches both `https://www.example.com/` and `http://www.example.com/`.

If a route pattern hostname begins with `*`, then it matches the host and all subhosts. If a route pattern hostname begins with `*.`, then it only matches all subhosts.

- `*example.com/` matches `https://example.com/` and `https://www.example.com/`.
- `*.example.com/` matches `https://www.example.com/` but not `https://example.com/`.

If a route pattern path ends with `*`, then it matches all suffixes of that path.

- `https://example.com/path*` matches `https://example.com/path` and `https://example.com/path2` and `https://example.com/path/readme.txt`

All domains and subdomains must have a [DNS record](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/) to be proxied on Cloudflare and used to invoke a Worker. For example, if you want to put a Worker on `myname.example.com`, and you have added `example.com` to Cloudflare but have not added any DNS records for `myname.example.com`, any request to `myname.example.com` will result in the error `ERR_NAME_NOT_RESOLVED`.