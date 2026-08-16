"""PDX Open Mic has no relational models to administer (the status board was removed 2026-06-29).
All operational state lives in the agent hub (`/hub`, event-sourced in PROJECT/.hub/)."""
from django.contrib import admin

admin.site.site_header = "PDX Open Mic"
admin.site.site_title = "PDX Open Mic admin"
admin.site.index_title = "Command center"
