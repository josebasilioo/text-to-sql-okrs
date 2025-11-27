create sequence collaborator_seq start with 1 increment by 50;
create sequence initiative_seq start with 1 increment by 50;
create sequence initiative_update_seq start with 1 increment by 50;
create sequence kr_history_seq start with 1 increment by 50;
create sequence kr_seq start with 1 increment by 50;
create sequence okr_seq start with 1 increment by 50;

create table collaborator (
   active boolean not null,
   created_date TIMESTAMP WITH TIME ZONE,
   id bigint not null,
   last_modified_date TIMESTAMP WITH TIME ZONE,
   created_by varchar(255),
   email varchar(255) not null,
   last_modified_by varchar(255),
   login varchar(255) not null,
   name varchar(255) not null,
   primary key (id)
);

    create table initiative (
        priority integer not null,
        created_date TIMESTAMP WITH TIME ZONE,
        end_date timestamp(6),
        id bigint not null,
        last_modified_date TIMESTAMP WITH TIME ZONE,
        owner_id bigint not null,
        start_date timestamp(6),
        category varchar(255) not null,
        created_by varchar(255),
        description varchar(255),
        last_modified_by varchar(255),
        title varchar(255) not null,
        primary key (id)
    );

    create table initiative_managers (
        initiative_id bigint not null,
        managers_id bigint not null
    );

    create table initiative_update (
        created_date TIMESTAMP WITH TIME ZONE,
        id bigint not null,
        initiative_id bigint not null,
        last_modified_date TIMESTAMP WITH TIME ZONE,
        brutal_facts TEXT,
        created_by varchar(255),
        highlights TEXT,
        last_modified_by varchar(255),
        next_steps TEXT,
        year_month bytea not null,
        primary key (id)
    );

    create table kr (
        bookmarked boolean not null,
        progress float(53) not null,
        target float(53) not null,
        bookmarked_by_id bigint,
        created_date TIMESTAMP WITH TIME ZONE,
        id bigint not null,
        last_modified_date TIMESTAMP WITH TIME ZONE,
        okr_id bigint not null,
        created_by varchar(255),
        direction varchar(255) not null,
        last_modified_by varchar(255),
        metric varchar(255) not null check (metric in ('PERC','NUMERIC','YES_NO')),
        title varchar(255) not null,
        primary key (id)
    );

    create table kr_history (
        progress float(53) not null,
        target float(53) not null,
        collaborator_id bigint not null,
        date timestamp(6) not null,
        id bigint not null,
        kr_id bigint not null,
        direction varchar(255) not null,
        metric varchar(255) not null check (metric in ('PERC','NUMERIC','YES_NO')),
        primary key (id)
    );

    create table okr (
        created_date TIMESTAMP WITH TIME ZONE,
        deadline timestamp(6) not null,
        id bigint not null,
        initiative_id bigint not null,
        last_modified_date TIMESTAMP WITH TIME ZONE,
        created_by varchar(255),
        description varchar(255) not null,
        last_modified_by varchar(255),
        primary key (id)
    );

    alter table if exists initiative
       add constraint FK5jp6rhmmv8aufftsvhkcd2kx5
       foreign key (owner_id)
       references collaborator;

    alter table if exists initiative_managers
       add constraint FK1lbmg2p8p0u0he55qv8lf8fm9
       foreign key (managers_id)
       references collaborator;

    alter table if exists initiative_managers
       add constraint FKn2knilpbihfym3lyr3s1sdwj1
       foreign key (initiative_id)
       references initiative;

    alter table if exists initiative_update
       add constraint FKqyy73u6x730xev86bbnlrf3dn
       foreign key (initiative_id)
       references initiative;

    alter table if exists kr
       add constraint FKholt28qibx4inhema1h4gkfv9
       foreign key (bookmarked_by_id)
       references collaborator;

    alter table if exists kr
       add constraint FKp23fw39mh0xof6l4051vkks69
       foreign key (okr_id)
       references okr;

    alter table if exists kr_history
       add constraint FKmgdy4nhq9f1auumvwcp38i1i5
       foreign key (collaborator_id)
       references collaborator;

    alter table if exists kr_history
       add constraint FKqirwki5pi7l97qwqttg72gcku
       foreign key (kr_id)
       references kr;

    alter table if exists okr
       add constraint FK263v8rgrgegc9m4589fsqbq4i
       foreign key (initiative_id)
       references initiative;
